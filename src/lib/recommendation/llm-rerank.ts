/**
 * LLM Reranking -- Second-Stage Recommendation Quality
 *
 * Takes the top N candidates from the rule-based scoring pipeline
 * and asks GPT-4o to rerank them based on how well they actually
 * match the user's intent. This catches everything the rule-based
 * scoring misses: nuance, context, common sense.
 *
 * Results are cached in Redis keyed by (candidate IDs + preference summary)
 * since temperature=0 makes output deterministic. Saves 1-3s per cache hit.
 *
 * Research basis: ICLR 2025 papers on LLM-based reranking show
 * significant precision improvements over traditional scoring.
 * Zero-shot, no training data needed.
 */

import { createHash } from 'crypto';
import OpenAI from 'openai';
import type { ScoredGame } from './scoring';
import type { QuestionnaireState } from '@/types/questionnaire';
import { MODELS } from '@/lib/llm/models';
import { redisCache } from '@/lib/redis';

const RERANK_TIMEOUT_MS = 12000;
const RERANK_CACHE_TTL = 600; // 10 minutes

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
  // For small candidate pools (e.g., user's collection), evaluate all of them.
  // For large pools, evaluate top 80 so the LLM sees well-known games that
  // rule-based scoring may have ranked at position 60-80.
  const maxCandidates = candidates.length <= 100 ? candidates.length : 80;

  // ── Rerank Cache ─────────────────────────────────────────────
  // temperature=0 makes output deterministic: same candidates + same prefs = same result.
  // Cache the ordered ID list to skip the 1-3s OpenAI call on repeat queries.
  const candidateIds = candidates.slice(0, maxCandidates).map((c) => c.game.id).sort();
  const cacheInput = JSON.stringify({ ids: candidateIds, prefs: wantsSummary, limit });
  const cacheHash = createHash('sha256').update(cacheInput).digest('hex').slice(0, 16);
  const cacheKey = `rerank:${cacheHash}`;

  const cachedIds = await redisCache.get<string[]>(cacheKey);
  if (cachedIds && cachedIds.length > 0) {
    console.log(`[LLM Rerank] Cache HIT (${cacheKey})`);
    return reconstructOrder(candidates, cachedIds);
  }

  const gameSummaries = candidates.slice(0, maxCandidates).map((c, i) => {
    const g = c.game;
    const parts = [`${i + 1}. "${g.name}" [ID:${g.id}]`];
    if (g.playTime?.average) parts.push(`${g.playTime.average}min`);
    if (g.playerCount) parts.push(`${g.playerCount.min}-${g.playerCount.max}p`);
    if (g.complexity) parts.push(`wt:${g.complexity.toFixed(1)}`);
    if (g.ratingCount) parts.push(`${g.ratingCount >= 1000 ? `${Math.round(g.ratingCount / 1000)}k` : g.ratingCount}votes`);
    if (g.categories.length > 0) parts.push(g.categories.slice(0, 3).join(','));
    if (g.mechanics.length > 0) parts.push(g.mechanics.slice(0, 3).join(','));
    return parts.join(' | ');
  }).join('\n');

  // Highlight notable well-known games in the full candidate pool that the LLM
  // might want to promote, even if they ranked below the visible window
  const notableGames = candidates
    .filter((c) => (c.game.ratingCount ?? 0) >= 20000)
    .map((c) => `"${c.game.name}" (${Math.round((c.game.ratingCount ?? 0) / 1000)}k votes)`)
    .slice(0, 10);
  const notableSection = notableGames.length > 0
    ? `\nNotable well-known games in the candidate pool: ${notableGames.join(', ')}\n`
    : '';

  const prompt = `You are a board game recommendation expert. A user is looking for a game with these preferences:

${wantsSummary.join('\n')}
${notableSection}
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
      model: MODELS.rerank,
      temperature: 0,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return candidates;

    const parsed = JSON.parse(raw);
    const rerankedIds: string[] = parsed.ids ?? [];

    if (rerankedIds.length === 0) return candidates;

    // Cache the result for future identical queries
    redisCache.set(cacheKey, rerankedIds, RERANK_CACHE_TTL);

    console.log(`[LLM Rerank] Reranked ${rerankedIds.length} games from ${candidates.length} candidates`);
    return reconstructOrder(candidates, rerankedIds);
  } catch (err) {
    console.error('[LLM Rerank] Failed, using original order:', err);
    return candidates;
  }
}

/**
 * Reconstruct the full candidate list in the order specified by rerankedIds.
 * LLM picks come first, then remaining candidates in original order.
 */
function reconstructOrder(candidates: ScoredGame[], rerankedIds: string[]): ScoredGame[] {
  const candidateMap = new Map(candidates.map((c) => [c.game.id, c]));
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

  return reranked;
}
