/**
 * LLM Reranking — Second-Stage Recommendation Quality
 *
 * Takes the top N candidates from the rule-based scoring pipeline
 * and asks GPT-4o to rerank them based on how well they actually
 * match the user's intent. This catches everything the rule-based
 * scoring misses: nuance, context, common sense.
 *
 * Research basis: ICLR 2025 papers on LLM-based reranking show
 * significant precision improvements over traditional scoring.
 * Zero-shot, no training data needed.
 */

import OpenAI from 'openai';
import type { ScoredGame } from './scoring';
import type { QuestionnaireState } from '@/types/questionnaire';

const RERANK_TIMEOUT_MS = 8000;

/**
 * Rerank the top candidates using GPT-4o.
 * Returns reordered candidates, or the original order on any failure.
 */
export async function llmRerank(
  candidates: ScoredGame[],
  prefs: QuestionnaireState,
  limit: number = 10,
): Promise<ScoredGame[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || candidates.length < 3) return candidates;

  // Build a concise summary of what the user wants
  const wantsSummary: string[] = [];
  if (prefs.freeText) wantsSummary.push(`User said: "${prefs.freeText}"`);
  if (prefs.gameTypes.length > 0) wantsSummary.push(`Game types: ${prefs.gameTypes.join(', ')}`);
  if (prefs.playerCount.min > 1 || prefs.playerCount.max < 10) {
    wantsSummary.push(`Players: ${prefs.playerCount.min}-${prefs.playerCount.max}`);
  }
  if (prefs.timePresets.length > 0) wantsSummary.push(`Time: ${prefs.timePresets.join(', ')}`);
  if (prefs.complexity.min > 1 || prefs.complexity.max < 5) {
    wantsSummary.push(`Complexity: ${prefs.complexity.min}-${prefs.complexity.max} out of 5`);
  }
  if (prefs.genres.length > 0) wantsSummary.push(`Genres: ${prefs.genres.join(', ')}`);
  if (prefs.moods.length > 0) wantsSummary.push(`Mood: ${prefs.moods.join(', ')}`);
  if (prefs.llmParsed?.mechanics?.length) wantsSummary.push(`Mechanics: ${prefs.llmParsed.mechanics.join(', ')}`);
  if (prefs.llmParsed?.similarTo?.length) wantsSummary.push(`Similar to: ${prefs.llmParsed.similarTo.join(', ')}`);
  if (prefs.llmParsed?.keywords?.length) wantsSummary.push(`Keywords: ${prefs.llmParsed.keywords.join(', ')}`);

  // Build compact game summaries for the LLM
  // For small candidate pools (e.g., user's collection), evaluate all of them
  const maxCandidates = candidates.length <= 50 ? candidates.length : 25;
  const gameSummaries = candidates.slice(0, maxCandidates).map((c, i) => {
    const g = c.game;
    const parts = [`${i + 1}. "${g.name}" [ID:${g.id}]`];
    if (g.playTime?.average) parts.push(`${g.playTime.average}min`);
    else if (g.playTime?.max) parts.push(`${g.playTime.min}-${g.playTime.max}min`);
    if (g.playerCount) parts.push(`${g.playerCount.min}-${g.playerCount.max}p`);
    if (g.complexity) parts.push(`complexity:${g.complexity.toFixed(1)}/5`);
    if (g.rating) parts.push(`rating:${g.rating.toFixed(1)}`);
    if (g.ratingCount) parts.push(`votes:${g.ratingCount >= 1000 ? `${Math.round(g.ratingCount / 1000)}k` : g.ratingCount}`);
    if (g.categories.length > 0) parts.push(`categories:[${g.categories.slice(0, 5).join(',')}]`);
    if (g.mechanics.length > 0) parts.push(`mechanics:[${g.mechanics.slice(0, 5).join(',')}]`);
    if (g.description) {
      const desc = g.description.slice(0, 120).replace(/\n/g, ' ');
      parts.push(`"${desc}..."`);
    }
    return parts.join(' | ');
  }).join('\n');

  const prompt = `You are a board game recommendation expert. A user is looking for a game with these preferences:

${wantsSummary.join('\n')}

Here are ${Math.min(candidates.length, maxCandidates)} candidate games from our database:

${gameSummaries}

Pick the ${limit} games that BEST match what this user is looking for.

Rules (follow these strictly):
1. RELEVANCE IS KING. If they asked for "deck building", only include games where deck building is a PRIMARY mechanic, not a minor side feature. Read the description to verify.
2. BASE GAMES FIRST. Never rank an expansion or variant above its base game. "Dominion" should always beat "Dominion: Intrigue". If both appear, only include the base game.
3. TIME LIMITS MATTER. If they said "under 30 minutes", exclude anything listed above 35 minutes.
4. PLAYER COUNT MATTERS. If they said "2 players", a game requiring 5+ is irrelevant.
5. WELL-KNOWN GAMES WIN TIES. Between two games that equally match the request, prefer the one with more votes. A 50,000-vote classic beats a 200-vote obscure game every time.
6. USE YOUR KNOWLEDGE. You know board games. If a game is famous for being a great deck builder (Dominion, Star Realms, Clank, Ascension, Shards of Infinity, Hero Realms), prioritize it even if the metadata doesn't perfectly highlight that.
7. EXCLUDE IRRELEVANT GAMES. If a game clearly doesn't match what the user asked for (e.g., a trick-taking game when they asked for deck building), leave it out entirely.

Return ONLY a JSON object: {"ids": ["game-id-1", "game-id-2", ...]} with the ${limit} best game IDs in order from best to worst match. No explanation needed.`;

  try {
    const openai = new OpenAI({ apiKey, timeout: RERANK_TIMEOUT_MS });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return candidates;

    const parsed = JSON.parse(raw);
    const rerankedIds: string[] = parsed.ids ?? [];

    if (rerankedIds.length === 0) return candidates;

    // Build a map for quick lookup
    const candidateMap = new Map(candidates.map((c) => [c.game.id, c]));

    // Reorder: LLM picks first, then remaining in original order
    const reranked: ScoredGame[] = [];
    const usedIds = new Set<string>();

    for (const id of rerankedIds) {
      const match = candidateMap.get(id);
      if (match && !usedIds.has(id)) {
        reranked.push(match);
        usedIds.add(id);
      }
    }

    // Append remaining candidates not picked by LLM
    for (const c of candidates) {
      if (!usedIds.has(c.game.id)) {
        reranked.push(c);
      }
    }

    console.log(`[LLM Rerank] Reranked ${rerankedIds.length} games from ${candidates.length} candidates`);
    return reranked;
  } catch (err) {
    console.error('[LLM Rerank] Failed, using original order:', err);
    return candidates;
  }
}
