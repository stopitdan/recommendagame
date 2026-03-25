/**
 * Similarity Search — Content-Based Filtering (Layer 2)
 *
 * Uses pgvector to find games most similar to a user's preferences.
 * This is the core of the content-based recommendation engine.
 *
 * Two modes:
 * 1. Preference → Games: "Find games matching these preferences"
 *    (encodes preferences as a vector, finds nearest neighbors)
 * 2. Game → Games: "Find games similar to this one"
 *    (looks up a game's embedding, finds nearest neighbors)
 */

import { createClient } from '@supabase/supabase-js';
import type { QuestionnaireState } from '@/types/questionnaire';
import type { Game } from '@/types/game';
import { rowToGame } from '@/lib/supabase/games';
import { preferencesToVector, cosineSimilarity, gameToVector, normalize } from './embeddings';

// ─── Types ───────────────────────────────────────────────────

export interface SimilarGame {
  game: Game;
  similarity: number;
}

// ─── DB Client ───────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Preference-Based Similarity Search ──────────────────────

/**
 * Finds games most similar to user preferences using pgvector.
 *
 * Uses the `match_games` RPC function defined in migration 001,
 * which performs approximate nearest neighbor search with HNSW index.
 */
export async function findSimilarToPreferences(
  prefs: QuestionnaireState,
  options: {
    limit?: number;
    similarityThreshold?: number;
    gameTypeFilter?: string | null;
  } = {},
): Promise<SimilarGame[]> {
  const {
    limit = 20,
    similarityThreshold = 0.3,
    gameTypeFilter = prefs.gameType,
  } = options;

  const supabase = getSupabase();
  if (!supabase) return [];

  const queryVector = preferencesToVector(prefs);

  // Use the match_games RPC function with pgvector
  const { data, error } = await supabase.rpc('match_games', {
    query_embedding: `[${queryVector.join(',')}]`,
    match_count: limit * 2, // Fetch extra for post-filtering
    similarity_threshold: similarityThreshold,
  });

  if (error) {
    console.error('[Similarity] RPC error:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Fetch full game data for matched IDs
  const gameIds = data.map((d: { game_id: string }) => d.game_id);
  const { data: gameRows, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .in('id', gameIds);

  if (gamesError || !gameRows) return [];

  // Build a map of game_id → similarity
  const simMap = new Map(data.map((d: { game_id: string; similarity: number }) => [d.game_id, d.similarity]));

  // Convert rows to Games and pair with similarity
  let results: SimilarGame[] = gameRows
    .map((row: any) => ({
      game: rowToGame(row),
      similarity: (simMap.get(row.id) as number) ?? 0,
    }))
    .sort((a: SimilarGame, b: SimilarGame) => b.similarity - a.similarity);

  // Post-filter by game type if specified
  if (gameTypeFilter) {
    results = results.filter((r) => r.game.types.includes(gameTypeFilter as Game['types'][number]));
  }

  return results.slice(0, limit);
}

// ─── Game-to-Game Similarity Search ──────────────────────────

/**
 * Finds games most similar to a given game.
 * Uses the game's existing embedding in the database.
 */
export async function findSimilarToGame(
  gameId: string,
  options: { limit?: number; similarityThreshold?: number } = {},
): Promise<SimilarGame[]> {
  const { limit = 10, similarityThreshold = 0.4 } = options;

  const supabase = getSupabase();
  if (!supabase) return [];

  // Get the game's embedding
  const { data: embData, error: embError } = await supabase
    .from('game_embeddings')
    .select('embedding')
    .eq('game_id', gameId)
    .single();

  if (embError || !embData) {
    console.error('[Similarity] No embedding for game:', gameId);
    return [];
  }

  // Search for similar games using the same embedding
  const { data, error } = await supabase.rpc('match_games', {
    query_embedding: embData.embedding,
    match_count: limit + 1, // +1 because the game itself will match
    similarity_threshold: similarityThreshold,
  });

  if (error || !data) return [];

  // Exclude the source game itself
  const filtered = data.filter((d: { game_id: string }) => d.game_id !== gameId);
  const gameIds = filtered.map((d: { game_id: string }) => d.game_id);

  if (gameIds.length === 0) return [];

  const { data: gameRows, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .in('id', gameIds);

  if (gamesError || !gameRows) return [];

  const simMap = new Map(filtered.map((d: { game_id: string; similarity: number }) => [d.game_id, d.similarity]));

  return gameRows
    .map((row: any) => ({
      game: rowToGame(row),
      similarity: (simMap.get(row.id) as number) ?? 0,
    }))
    .sort((a: SimilarGame, b: SimilarGame) => b.similarity - a.similarity)
    .slice(0, limit);
}

// ─── In-Memory Similarity (fallback) ─────────────────────────

/**
 * Computes similarity between preferences and games in-memory.
 * Used as a fallback when pgvector embeddings haven't been generated yet.
 * Slower but works without any DB setup.
 */
export function computeSimilarityInMemory(
  prefs: QuestionnaireState,
  games: Game[],
  limit = 20,
): SimilarGame[] {
  const prefVector = preferencesToVector(prefs);

  return games
    .map((game) => ({
      game,
      similarity: cosineSimilarity(prefVector, normalize(gameToVector(game))),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
