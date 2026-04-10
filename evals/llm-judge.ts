/**
 * LLM-as-Judge for Recommendation Quality
 *
 * Uses GPT-4o-mini to evaluate whether recommendation results
 * actually match what a user was looking for.
 *
 * Improvements based on Zheng et al. (2023) "Judging LLM-as-a-Judge":
 * - Few-shot examples (65% -> 77.5% consistency)
 * - Chain-of-thought reasoning before scoring
 * - Position randomization to mitigate position bias
 * - Split criteria (constraint satisfaction, relevance, diversity)
 *
 * Cost: ~$0.0003 per judgment call
 */

import OpenAI from 'openai';

interface JudgeInput {
  query: string;
  gameTypes?: string[];
  playerCount?: { min: number; max: number };
  constraints?: Record<string, any>;
  results: { name: string; rank: number; categories?: string[]; mechanics?: string[]; complexity?: number; avgPlayTime?: number; minPlayers?: number; maxPlayers?: number }[];
}

interface JudgeOutput {
  score: number;       // 0-10 (average of sub-scores)
  reasoning: string;   // Chain-of-thought analysis
  violations: string[]; // Specific issues found
  subScores: {
    constraintSatisfaction: number; // 0-10
    relevance: number;              // 0-10
    diversity: number;              // 0-10
  };
}

const JUDGE_PROMPT = `You are evaluating a game recommendation engine. Given a user's query and the results, rate how well the recommendations match what the user wanted.

## Evaluation Process

First, analyze EACH result individually for relevance and constraint compliance. Then provide THREE separate sub-scores:

### Sub-Score 1: Constraint Satisfaction (0-10)
How well do results respect explicit constraints (player count, time limit, complexity, game type)?
- 10: Zero constraint violations
- 7-9: 1 minor violation (e.g., 5 min over time limit)
- 4-6: Multiple violations or 1 major violation
- 0-3: Most results violate stated constraints

### Sub-Score 2: Relevance (0-10)
How well do results match the spirit and intent of the query?
- 10: Every result is exactly what the user described
- 7-9: Most results are great matches, 1-2 tangentially related
- 4-6: Mixed -- some relevant, some clearly off-topic
- 0-3: Results don't match what was asked

### Sub-Score 3: Diversity (0-10)
Do results offer variety, or are they all the same type?
- 10: Good variety of designers, mechanics, themes within the query scope
- 7-9: Mostly diverse with some overlap
- 4-6: Noticeable clustering -- many similar games
- 0-3: Nearly identical games repeated

## Few-Shot Examples

### Example 1 (Score: 9/10)
Query: "deck building games for 2 players"
Player count: 2-2
Results: Dominion (2-4p, 30min), Star Realms (2p, 20min), Clank! (2-4p, 60min), Aeon's End (1-4p, 60min), Harry Potter: Hogwarts Battle (2-4p, 45min), Shards of Infinity (2p, 30min), Ascension (1-4p, 30min), Legendary (1-5p, 45min), Thunderstone Quest (2-4p, 90min), The Quest for El Dorado (2-4p, 45min)
Analysis: All are deck builders. All support 2 players. Good variety of themes and complexity. Dominion and Star Realms are canonical. Score: constraint=10, relevance=9, diversity=8. Average: 9.

### Example 2 (Score: 5/10)
Query: "chill cooperative games under 45 minutes"
Time: max 45 minutes
Results: Pandemic (45min), The Crew (20min), Hanabi (25min), Spirit Island (120min), Gloomhaven (120min), Forbidden Island (30min), Castle Panic (60min), Mysterium (42min), Arkham Horror LCG (60min), Flash Point (45min)
Analysis: Spirit Island (120min) and Gloomhaven (120min) are major time violations. Arkham Horror LCG (60min) and Castle Panic (60min) also exceed limit. 4/10 results violate time. Good cooperative games otherwise. Score: constraint=4, relevance=7, diversity=6. Average: 5.7 -> 5.

### Example 3 (Score: 2/10)
Query: "anime-themed strategy board games"
Results: Catan (no anime), Ticket to Ride (no anime), Carcassonne (no anime), Pandemic (no anime), Azul (no anime), 7 Wonders (no anime), Splendor (no anime), Codenames (no anime), Wingspan (no anime), Dominion (no anime)
Analysis: Zero results match "anime-themed." These are just popular board games with no anime connection. Complete genre mismatch. Score: constraint=5, relevance=0, diversity=3. Average: 2.7 -> 2.

## Instructions

Think step-by-step:
1. List each result and whether it matches the query
2. Check for constraint violations (player count, time, complexity)
3. Assess overall relevance to the query's intent
4. Score each sub-dimension

Return JSON: {"constraintSatisfaction": number, "relevance": number, "diversity": number, "reasoning": "string", "violations": ["string"]}`;

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  openaiClient = new OpenAI({ apiKey, timeout: 20000 });
  return openaiClient;
}

/**
 * Shuffle an array using Fisher-Yates to mitigate position bias.
 * Returns the shuffled array and a mapping from shuffled index to original rank.
 */
function shuffleWithMapping<T>(arr: T[]): { shuffled: T[]; originalRanks: number[] } {
  const indices = arr.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return {
    shuffled: indices.map(i => arr[i]),
    originalRanks: indices.map(i => i + 1),
  };
}

export async function judgeResults(input: JudgeInput): Promise<JudgeOutput | null> {
  const client = getClient();
  if (!client) return null;

  // Shuffle results to mitigate position bias (Zheng et al. 2023)
  const topResults = input.results.slice(0, 10);
  const { shuffled } = shuffleWithMapping(topResults);

  const resultsSummary = shuffled.map((r, i) => {
    const parts = [`Result ${i + 1}: ${r.name}`];
    if (r.categories?.length) parts.push(`cats=[${r.categories.slice(0, 3).join(',')}]`);
    if (r.mechanics?.length) parts.push(`mechs=[${r.mechanics.slice(0, 3).join(',')}]`);
    if (r.minPlayers != null) parts.push(`${r.minPlayers}-${r.maxPlayers}p`);
    if (r.avgPlayTime != null) parts.push(`${r.avgPlayTime}min`);
    if (r.complexity != null) parts.push(`wt=${r.complexity.toFixed(1)}`);
    return parts.join(' | ');
  }).join('\n');

  const constraintStr = input.constraints
    ? `\nConstraints: ${JSON.stringify(input.constraints)}`
    : '';

  const userMsg = `Query: "${input.query}"
Game types: ${input.gameTypes?.join(', ') || 'any'}
Player count: ${input.playerCount ? `${input.playerCount.min}-${input.playerCount.max}` : 'any'}${constraintStr}

Results (presented in random order to avoid bias):
${resultsSummary}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: JUDGE_PROMPT },
        { role: 'user', content: userMsg },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const cs = Math.max(0, Math.min(10, parsed.constraintSatisfaction ?? 5));
    const rel = Math.max(0, Math.min(10, parsed.relevance ?? 5));
    const div = Math.max(0, Math.min(10, parsed.diversity ?? 5));
    const avg = (cs + rel + div) / 3;

    return {
      score: Math.round(avg * 10) / 10,
      reasoning: parsed.reasoning ?? '',
      violations: Array.isArray(parsed.violations) ? parsed.violations : [],
      subScores: {
        constraintSatisfaction: cs,
        relevance: rel,
        diversity: div,
      },
    };
  } catch (err) {
    console.error('[LLM Judge] Error:', err instanceof Error ? err.message : err);
    return null;
  }
}
