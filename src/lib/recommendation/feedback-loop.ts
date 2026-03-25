/**
 * Feedback Loop — Layer 4
 *
 * Closes the learning loop: when a user rates/reviews a game,
 * their preference vector gets updated to reflect what they
 * liked and disliked. Over time, this makes the content-based
 * recommendations increasingly personalized.
 *
 * How it works:
 *   1. User reviews a game → triggers vector update
 *   2. Game's embedding vector is fetched (or computed)
 *   3. User's preference_vector is pulled toward liked games
 *      and pushed away from disliked games
 *   4. Updated preference_vector is saved to user_preferences
 *
 * The math:
 *   new_vector = normalize(
 *     old_vector + learning_rate * rating_signal * game_vector
 *   )
 *
 * Where rating_signal is:
 *   - Positive for liked games (rating >= 7):  +0.1 to +0.3
 *   - Negative for disliked games (rating <= 4): -0.1 to -0.2
 *   - Neutral for middle ratings: small positive (still useful data)
 */

import { createClient } from '@supabase/supabase-js';
import { gameToVector, normalize, VECTOR_DIM } from './embeddings';
import { rowToGame } from '@/lib/supabase/games';

// ─── Config ──────────────────────────────────────────────────

/** How much each review shifts the preference vector */
const LEARNING_RATE = 0.15;

/** Reviews above this are "liked" */
const POSITIVE_THRESHOLD = 7;

/** Reviews below this are "disliked" */
const NEGATIVE_THRESHOLD = 4;

// ─── DB Client ───────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Preference Vector Update ────────────────────────────────

/**
 * Updates a user's preference vector based on a new review.
 *
 * Called after a user submits a review for a game. The user's
 * preference_vector in user_preferences gets adjusted toward
 * or away from the game's embedding.
 */
export async function updatePreferenceVector(
  userId: string,
  gameId: string,
  rating: number,
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: 'DB not configured' };

  // 1. Get the game's embedding (or compute it)
  let gameVector: number[];

  const { data: embData } = await supabase
    .from('game_embeddings')
    .select('embedding')
    .eq('game_id', gameId)
    .single();

  if (embData?.embedding) {
    // Parse the vector from DB format
    gameVector = typeof embData.embedding === 'string'
      ? JSON.parse(embData.embedding)
      : embData.embedding;
  } else {
    // Compute on the fly from game data
    const { data: gameRow } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!gameRow) return { success: false, error: 'Game not found' };

    const game = rowToGame(gameRow);
    gameVector = normalize(gameToVector(game));
  }

  // 2. Get the user's current preference vector
  const { data: prefData } = await supabase
    .from('user_preferences')
    .select('preference_vector')
    .eq('id', userId)
    .single();

  let currentVector: number[];

  if (prefData?.preference_vector) {
    currentVector = typeof prefData.preference_vector === 'string'
      ? JSON.parse(prefData.preference_vector)
      : prefData.preference_vector;
  } else {
    // Initialize to zero vector (will be pulled toward first liked game)
    currentVector = new Array(VECTOR_DIM).fill(0);
  }

  // 3. Compute the adjustment signal
  const signal = ratingToSignal(rating);
  const adjustedVector = new Array(VECTOR_DIM);

  for (let i = 0; i < VECTOR_DIM; i++) {
    adjustedVector[i] = currentVector[i] + LEARNING_RATE * signal * gameVector[i];
  }

  const newVector = normalize(adjustedVector);

  // 4. Upsert the updated preference vector
  const { error: upsertError } = await supabase
    .from('user_preferences')
    .upsert({
      id: userId,
      preference_vector: `[${newVector.join(',')}]`,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (upsertError) {
    console.error('[Feedback] Upsert error:', upsertError);
    return { success: false, error: upsertError.message };
  }

  return { success: true };
}

/**
 * Converts a 1-10 rating into a learning signal.
 *
 * - Ratings 8-10: strong positive pull (+0.2 to +0.3)
 * - Ratings 7:    moderate positive (+0.1)
 * - Ratings 5-6:  weak positive (+0.03 to +0.05)
 * - Ratings 3-4:  weak negative (-0.05 to -0.1)
 * - Ratings 1-2:  strong negative (-0.15 to -0.2)
 */
export function ratingToSignal(rating: number): number {
  if (rating >= 9) return 0.3;
  if (rating >= 8) return 0.2;
  if (rating >= 7) return 0.1;
  if (rating >= 6) return 0.05;
  if (rating >= 5) return 0.03;
  if (rating >= 4) return -0.05;
  if (rating >= 3) return -0.1;
  if (rating >= 2) return -0.15;
  return -0.2; // rating 1
}

// ─── Batch Preference Rebuild ────────────────────────────────

/**
 * Rebuilds a user's preference vector from scratch using all their
 * reviews. Useful if the vector gets corrupted or the embedding
 * model changes.
 */
export async function rebuildPreferenceVector(
  userId: string,
): Promise<{ success: boolean; reviewCount: number }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, reviewCount: 0 };

  // Get all the user's reviews
  const { data: reviews, error: reviewError } = await supabase
    .from('user_reviews')
    .select('game_id, rating')
    .eq('user_id', userId);

  if (reviewError || !reviews || reviews.length === 0) {
    return { success: false, reviewCount: 0 };
  }

  // Get game data for all reviewed games
  const gameIds = reviews.map((r: any) => r.game_id);
  const { data: gameRows } = await supabase
    .from('games')
    .select('*')
    .in('id', gameIds);

  if (!gameRows) return { success: false, reviewCount: reviews.length };

  const gameMap = new Map(gameRows.map((row: any) => [row.id, rowToGame(row)]));

  // Build the preference vector from all reviews
  const prefVector = new Array(VECTOR_DIM).fill(0);

  for (const review of reviews) {
    const game = gameMap.get((review as any).game_id);
    if (!game) continue;

    const gameVec = normalize(gameToVector(game));
    const signal = ratingToSignal((review as any).rating);

    for (let i = 0; i < VECTOR_DIM; i++) {
      prefVector[i] += signal * gameVec[i];
    }
  }

  const normalizedPref = normalize(prefVector);

  // Save
  const { error: upsertError } = await supabase
    .from('user_preferences')
    .upsert({
      id: userId,
      preference_vector: `[${normalizedPref.join(',')}]`,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  return {
    success: !upsertError,
    reviewCount: reviews.length,
  };
}
