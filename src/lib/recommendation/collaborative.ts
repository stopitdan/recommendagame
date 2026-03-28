/**
 * Collaborative Filtering — Layer 3
 *
 * "Users who liked X also liked Y"
 *
 * Two approaches:
 *
 * 1. Item-based: Find games that are frequently liked together.
 *    For game G, find other games that users who liked G also liked.
 *    This is the simpler and more scalable approach.
 *
 * 2. User-based: Find users with similar taste (similar feedback
 *    patterns), then recommend games those similar users liked.
 *    More personalized but requires enough feedback data.
 *
 * This module works with the user_game_feedback and user_reviews
 * tables. It needs a minimum number of reviews/feedback entries
 * before it can produce meaningful signals.
 *
 * Collaborative signals are meant to supplement (not replace)
 * the rule-based and content-based layers.
 */

import { createClient } from '@supabase/supabase-js';
import type { Game } from '@/types/game';
import { rowToGame } from '@/lib/supabase/games';

// ─── Types ───────────────────────────────────────────────────

export interface CollaborativeSignal {
  gameId: string;
  score: number;
  reason: string;
}

// ─── Config ──────────────────────────────────────────────────

/** Minimum reviews/feedback needed before collaborative filtering activates */
const MIN_FEEDBACK_FOR_ITEM_CF = 3;
const MIN_FEEDBACK_FOR_USER_CF = 3;

// ─── DB Client ───────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Item-Based Collaborative Filtering ──────────────────────

/**
 * For a set of games the user has liked, find other games that
 * users who liked those games also liked.
 *
 * SQL logic:
 *   1. Get all users who positively rated/reviewed the liked games
 *   2. Find other games those users also rated positively
 *   3. Rank by frequency (how many similar users liked it)
 *   4. Exclude games the user has already seen
 */
export async function getItemBasedRecommendations(
  likedGameIds: string[],
  options: {
    limit?: number;
    excludeGameIds?: string[];
    userId?: string;
  } = {},
): Promise<CollaborativeSignal[]> {
  const { limit = 20, excludeGameIds = [], userId } = options;

  if (likedGameIds.length === 0) return [];

  const supabase = getSupabase();
  if (!supabase) return [];

  // Check if we have enough feedback data
  const { count } = await supabase
    .from('user_reviews')
    .select('*', { count: 'exact', head: true });

  if ((count ?? 0) < MIN_FEEDBACK_FOR_ITEM_CF) return [];

  // Find users who liked the same games (via reviews with rating >= 7)
  const { data: similarUserReviews, error: userError } = await supabase
    .from('user_reviews')
    .select('user_id')
    .in('game_id', likedGameIds)
    .gte('rating', 7);

  if (userError || !similarUserReviews || similarUserReviews.length === 0) return [];

  const similarUserIds = [...new Set(similarUserReviews.map((r: any) => r.user_id))];

  // Exclude the requesting user
  const filteredUserIds = userId
    ? similarUserIds.filter((id) => id !== userId)
    : similarUserIds;

  if (filteredUserIds.length === 0) return [];

  // Find games those users also liked
  const { data: otherReviews, error: reviewError } = await supabase
    .from('user_reviews')
    .select('game_id')
    .in('user_id', filteredUserIds)
    .gte('rating', 7);

  if (reviewError || !otherReviews) return [];

  // Count frequency of each game
  const gameFrequency = new Map<string, number>();
  const allExcluded = new Set([...likedGameIds, ...excludeGameIds]);

  for (const review of otherReviews) {
    const gid = (review as any).game_id;
    if (allExcluded.has(gid)) continue;
    gameFrequency.set(gid, (gameFrequency.get(gid) ?? 0) + 1);
  }

  // Sort by frequency and take top N
  const sorted = [...gameFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Normalize scores to 0-1
  const maxFreq = sorted.length > 0 ? sorted[0][1] : 1;

  return sorted.map(([gameId, freq]) => ({
    gameId,
    score: freq / maxFreq,
    reason: `Liked by ${freq} users with similar taste`,
  }));
}

// ─── User-Based Collaborative Filtering ──────────────────────

/**
 * Find users with similar taste to the current user, then
 * recommend games those similar users liked that the current
 * user hasn't rated yet.
 *
 * Similarity is computed as the overlap in positively-rated games.
 */
export async function getUserBasedRecommendations(
  userId: string,
  options: { limit?: number } = {},
): Promise<CollaborativeSignal[]> {
  const { limit = 20 } = options;

  const supabase = getSupabase();
  if (!supabase) return [];

  // Get the user's positive reviews
  const { data: userReviews, error: userError } = await supabase
    .from('user_reviews')
    .select('game_id, rating')
    .eq('user_id', userId)
    .gte('rating', 6);

  if (userError || !userReviews || userReviews.length < MIN_FEEDBACK_FOR_USER_CF) return [];

  const userLikedGames = new Set(userReviews.map((r: any) => r.game_id));

  // Find other users who liked the same games
  const { data: otherReviews, error: otherError } = await supabase
    .from('user_reviews')
    .select('user_id, game_id, rating')
    .in('game_id', [...userLikedGames])
    .gte('rating', 6)
    .neq('user_id', userId);

  if (otherError || !otherReviews) return [];

  // Compute similarity for each other user (Jaccard-like overlap)
  const userOverlap = new Map<string, Set<string>>();
  for (const review of otherReviews) {
    const uid = (review as any).user_id;
    const gid = (review as any).game_id;
    if (!userOverlap.has(uid)) userOverlap.set(uid, new Set());
    userOverlap.get(uid)!.add(gid);
  }

  // Rank users by overlap count
  const rankedUsers = [...userOverlap.entries()]
    .map(([uid, games]) => ({
      userId: uid,
      overlap: [...games].filter((g) => userLikedGames.has(g)).length,
      totalGames: games.size,
    }))
    .filter((u) => u.overlap >= 2) // Minimum 2 shared likes
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 50); // Top 50 similar users

  if (rankedUsers.length === 0) return [];

  // Get games the similar users liked that the current user hasn't rated
  const similarUserIds = rankedUsers.map((u) => u.userId);
  const { data: recs, error: recError } = await supabase
    .from('user_reviews')
    .select('game_id, rating, user_id')
    .in('user_id', similarUserIds)
    .gte('rating', 7);

  if (recError || !recs) return [];

  // Score each game by weighted frequency (more similar users = higher weight)
  const userSimilarity = new Map(rankedUsers.map((u) => [u.userId, u.overlap]));
  const gameScores = new Map<string, number>();

  for (const rec of recs) {
    const gid = (rec as any).game_id;
    const uid = (rec as any).user_id;
    if (userLikedGames.has(gid)) continue; // Already liked
    const weight = userSimilarity.get(uid) ?? 1;
    gameScores.set(gid, (gameScores.get(gid) ?? 0) + weight);
  }

  const sorted = [...gameScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const maxScore = sorted.length > 0 ? sorted[0][1] : 1;

  return sorted.map(([gameId, score]) => ({
    gameId,
    score: score / maxScore,
    reason: 'Recommended by users with similar taste',
  }));
}

// ─── Combined Collaborative Signal ───────────────────────────

/**
 * Gets collaborative filtering signals for a user.
 * Tries user-based first (more personalized), falls back to item-based.
 * Returns a Map of gameId → { score, reason } for easy merging.
 */
export async function getCollaborativeSignals(
  userId: string | null,
  likedGameIds: string[],
): Promise<Map<string, CollaborativeSignal>> {
  const signals = new Map<string, CollaborativeSignal>();

  // User-based CF (if logged in with enough history)
  if (userId) {
    const userBased = await getUserBasedRecommendations(userId, { limit: 50 });
    for (const signal of userBased) {
      signals.set(signal.gameId, signal);
    }
  }

  // Item-based CF (works for anyone with liked games)
  if (likedGameIds.length > 0) {
    const itemBased = await getItemBasedRecommendations(likedGameIds, {
      limit: 50,
      userId: userId ?? undefined,
    });
    for (const signal of itemBased) {
      // Item-based supplements user-based (don't override higher scores)
      if (!signals.has(signal.gameId) || (signals.get(signal.gameId)!.score < signal.score)) {
        signals.set(signal.gameId, signal);
      }
    }
  }

  return signals;
}
