/**
 * LLM-as-Judge for Recommendation Quality
 *
 * Uses GPT-4o-mini to evaluate whether recommendation results
 * actually match what a user was looking for. This catches
 * failures that substring matching misses entirely.
 *
 * Cost: ~$0.0002 per judgment call
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
  score: number;       // 0-10
  reasoning: string;   // Why this score
  violations: string[]; // Specific issues found
}

const JUDGE_PROMPT = `You are evaluating a game recommendation engine. Given a user's query and the top 10 results, rate how well the recommendations match what the user wanted.

Score from 0-10:
- 10: Perfect. Every result is exactly what the user asked for.
- 8-9: Excellent. Most results are great, maybe 1-2 slight mismatches.
- 6-7: Good. Several good matches but some clearly wrong results.
- 4-5: Mediocre. Mix of relevant and irrelevant results.
- 2-3: Poor. Most results don't match what was asked.
- 0-1: Terrible. Results are completely unrelated to the query.

Pay special attention to:
1. CONSTRAINT VIOLATIONS: If user asked for "2 players" and a game needs 4+, that's a hard failure.
2. GENRE MISMATCH: If user asked for "anime games" and gets Uno, that's wrong.
3. RELEVANCE: Do the games match the spirit of what was asked?
4. DIVERSITY: Are results varied or all the same type?

Return JSON: {"score": number, "reasoning": "string", "violations": ["string"]}`;

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  openaiClient = new OpenAI({ apiKey, timeout: 15000 });
  return openaiClient;
}

export async function judgeResults(input: JudgeInput): Promise<JudgeOutput | null> {
  const client = getClient();
  if (!client) return null;

  const resultsSummary = input.results.slice(0, 10).map(r => {
    const parts = [`#${r.rank} ${r.name}`];
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

Results:
${resultsSummary}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: JUDGE_PROMPT },
        { role: 'user', content: userMsg },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return {
      score: Math.max(0, Math.min(10, parsed.score ?? 0)),
      reasoning: parsed.reasoning ?? '',
      violations: Array.isArray(parsed.violations) ? parsed.violations : [],
    };
  } catch (err) {
    console.error('[LLM Judge] Error:', err instanceof Error ? err.message : err);
    return null;
  }
}
