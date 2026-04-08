/**
 * Diversity Re-ranking
 *
 * After the scoring engine produces a ranked list, this module
 * re-orders results to maximize category/mechanic diversity.
 *
 * Problem: Without diversity, "Strategy" fans get 20 strategy games
 * in a row. With diversity, they get strategy games interspersed
 * with related genres they might also enjoy.
 *
 * Algorithm: Maximal Marginal Relevance (MMR)-inspired.
 * For each slot, pick the game that maximizes:
 *   score * (1 - LAMBDA) + novelty * LAMBDA
 *
 * Where novelty = how different this game's tags are from
 * games already selected.
 */

import type { ScoredGame } from './scoring';

// ─── Config ──────────────────────────────────────────────────

/**
 * How much to weight diversity vs. raw score.
 * 0.0 = pure score ranking (no diversity)
 * 1.0 = pure diversity (ignore scores)
 * 0.12 = gentle diversity nudge — prevents homogeneous results without
 *        demoting relevant canonical games that share tags (e.g., both
 *        Dominion and Star Realms should appear for "deck building")
 */
const DIVERSITY_LAMBDA = 0.12;

/** Only apply diversity to the top N results (don't re-rank the tail) */
const DIVERSITY_WINDOW = 30;

// ─── Main ────────────────────────────────────────────────────

/**
 * Re-ranks scored games to improve diversity.
 *
 * The top DIVERSITY_WINDOW results are re-ordered using MMR.
 * Results beyond the window keep their original order.
 */
export function diversityRerank(scored: ScoredGame[]): ScoredGame[] {
  if (scored.length <= 2) return scored;

  const window = Math.min(DIVERSITY_WINDOW, scored.length);
  const candidates = scored.slice(0, window);
  const tail = scored.slice(window);

  const reranked = mmrRerank(candidates, DIVERSITY_LAMBDA);
  return [...reranked, ...tail];
}

// ─── MMR Re-ranking ──────────────────────────────────────────

/**
 * Greedy MMR selection: iteratively pick the candidate that
 * maximizes (1 - lambda) * score + lambda * novelty.
 */
function mmrRerank(candidates: ScoredGame[], lambda: number): ScoredGame[] {
  if (candidates.length === 0) return [];

  // Sort descending so normalization and first-pick are correct
  candidates.sort((a, b) => b.score - a.score);

  // Normalize scores to 0-1 for fair comparison with novelty
  const maxScore = candidates[0].score;
  const minScore = candidates[candidates.length - 1].score;
  const scoreRange = maxScore - minScore || 1;

  // Pre-compute tag sets for each game
  const tagSets = candidates.map((c) => getTagSet(c));

  const selected: ScoredGame[] = [];
  const remaining = new Set(candidates.map((_, i) => i));
  const selectedTags = new Set<string>();

  // Always pick the top-scored game first
  selected.push(candidates[0]);
  remaining.delete(0);
  for (const tag of tagSets[0]) selectedTags.add(tag);

  while (remaining.size > 0) {
    let bestIdx = -1;
    let bestMmr = -Infinity;

    for (const idx of remaining) {
      const normalizedScore = (candidates[idx].score - minScore) / scoreRange;
      const novelty = computeNovelty(tagSets[idx], selectedTags);
      const mmr = (1 - lambda) * normalizedScore + lambda * novelty;

      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = idx;
      }
    }

    if (bestIdx === -1) break;

    selected.push(candidates[bestIdx]);
    remaining.delete(bestIdx);
    for (const tag of tagSets[bestIdx]) selectedTags.add(tag);
  }

  return selected;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Extract a set of tags (categories + mechanics + themes) from a scored game */
function getTagSet(scored: ScoredGame): Set<string> {
  const tags = new Set<string>();
  for (const c of scored.game.categories) tags.add(c.toLowerCase());
  for (const m of scored.game.mechanics) tags.add(m.toLowerCase());
  for (const t of scored.game.themes) tags.add(t.toLowerCase());
  return tags;
}

/**
 * Novelty = fraction of this game's tags that are NOT in the already-selected set.
 * 1.0 = completely novel (no overlap), 0.0 = all tags already covered.
 */
function computeNovelty(gameTags: Set<string>, selectedTags: Set<string>): number {
  if (gameTags.size === 0) return 0.5; // Unknown tags = neutral

  let novel = 0;
  for (const tag of gameTags) {
    if (!selectedTags.has(tag)) novel++;
  }
  return novel / gameTags.size;
}
