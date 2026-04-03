/**
 * Rejection Learning
 *
 * When a user clicks "Not This" on a game, we record negative feedback.
 * This module uses that feedback to penalize games with similar
 * characteristics in future recommendations.
 *
 * How it works:
 *   1. Fetch the user's negative feedback (rating = -1)
 *   2. Look up the rejected games' categories/mechanics/themes
 *   3. Build a "rejection profile" — tags the user dislikes
 *   4. Penalize candidate games that match those tags
 *
 * The penalty is proportional to how many rejected tags match.
 * A game matching 1 rejected tag gets a mild penalty.
 * A game matching 3+ rejected tags gets a strong penalty.
 */

import { createClient } from '@supabase/supabase-js';
import type { Game } from '@/types/game';

// ─── Types ───────────────────────────────────────────────────

export interface RejectionProfile {
  /** Tags the user has rejected, with frequency counts */
  rejectedTags: Map<string, number>;
  /** Game IDs the user explicitly dismissed */
  rejectedGameIds: Set<string>;
  /** Total number of rejections (for normalization) */
  totalRejections: number;
}

// ─── DB Client ───────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Profile Building ────────────────────────────────────────

/**
 * Builds a rejection profile from a user's negative feedback.
 * Returns null if the user has no rejections or isn't logged in.
 */
export async function buildRejectionProfile(
  userId: string | null,
): Promise<RejectionProfile | null> {
  if (!userId) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  // Fetch negative feedback
  const { data: feedback, error } = await supabase
    .from('user_game_feedback')
    .select('game_id')
    .eq('user_id', userId)
    .eq('rating', -1);

  if (error || !feedback || feedback.length === 0) return null;

  const rejectedGameIds = new Set(feedback.map((f: any) => f.game_id));

  // Fetch the rejected games' tags
  const { data: games } = await supabase
    .from('games')
    .select('categories, mechanics, themes')
    .in('id', [...rejectedGameIds]);

  if (!games || games.length === 0) {
    return { rejectedTags: new Map(), rejectedGameIds, totalRejections: feedback.length };
  }

  // Count tag frequencies across rejected games
  const tagCounts = new Map<string, number>();
  for (const game of games) {
    const tags = [
      ...((game as any).categories ?? []),
      ...((game as any).mechanics ?? []),
      ...((game as any).themes ?? []),
    ];
    for (const tag of tags) {
      const lower = tag.toLowerCase();
      tagCounts.set(lower, (tagCounts.get(lower) ?? 0) + 1);
    }
  }

  return {
    rejectedTags: tagCounts,
    rejectedGameIds,
    totalRejections: feedback.length,
  };
}

// ─── Penalty Scoring ─────────────────────────────────────────

/**
 * Computes a rejection penalty for a game (0 to 1).
 * 0.0 = no penalty (game doesn't match rejected tags)
 * 1.0 = maximum penalty (game strongly matches rejection profile)
 *
 * Usage: subtract penalty * weight from the game's score.
 */
export function computeRejectionPenalty(
  game: Game,
  profile: RejectionProfile,
): number {
  // Explicitly rejected game → maximum penalty
  if (profile.rejectedGameIds.has(game.id)) return 1.0;

  if (profile.rejectedTags.size === 0) return 0;

  const gameTags = [
    ...game.categories,
    ...game.mechanics,
    ...game.themes,
  ].map((t) => t.toLowerCase());

  if (gameTags.length === 0) return 0;

  // Count how many of this game's tags appear in the rejection profile,
  // but only count tags that were rejected MULTIPLE times (≥2).
  // A single rejection creates ~20 tags from one game's metadata — those
  // are too noisy to penalize on. Only repeated rejections of the same
  // tag indicate a real dislike pattern.
  let matchedWeight = 0;
  for (const tag of gameTags) {
    const rejectionCount = profile.rejectedTags.get(tag) ?? 0;
    if (rejectionCount >= 2) {
      matchedWeight += Math.min(rejectionCount / profile.totalRejections, 0.3);
    }
  }

  // Normalize by game's tag count (a game with 1 matching tag out of 10 is mild)
  const penalty = matchedWeight / gameTags.length;

  // Cap at 0.5 — rejection is a soft signal, not a hard filter
  return Math.min(penalty * 2, 0.5);
}
