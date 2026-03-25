/**
 * Game Sync Service
 *
 * Syncs games from external API adapters into the local Supabase database.
 * This is the bridge that populates our DB so we can query locally instead
 * of hitting rate-limited external APIs on every user request.
 *
 * Usage:
 * - Call syncPopularGames() to seed the DB with trending games from all sources
 * - Call syncSearchResults() to cache search results as users search
 * - Call syncGames() directly to upsert any array of Game objects
 *
 * Uses the service role client (bypasses RLS) since this is a system operation.
 */

import { createClient } from '@supabase/supabase-js';
import type { Game, GameAdapter } from '@/types/game';
import { gameToInsert } from '@/lib/supabase/games';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  source: string;
  attempted: number;
  succeeded: number;
  failed: number;
  errors: SyncError[];
}

export interface SyncError {
  gameId: string;
  gameName: string;
  error: string;
}

export interface SyncOptions {
  /** Number of games to upsert per batch. Default: 50 */
  batchSize?: number;
  /** If true, log progress to console. Default: true */
  verbose?: boolean;
}

// ---------------------------------------------------------------------------
// Supabase Client (for sync operations)
// ---------------------------------------------------------------------------

/**
 * Creates a Supabase client for sync operations.
 * Uses the service role key to bypass RLS.
 *
 * This is a standalone client (not using @supabase/ssr) because the sync
 * service runs outside of Next.js request context (cron jobs, scripts).
 */
function createSyncClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('[Sync] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Core Sync Logic
// ---------------------------------------------------------------------------

/**
 * Upserts an array of Game objects into Supabase.
 * Uses upsert with onConflict to handle duplicates gracefully.
 *
 * Returns a SyncResult with counts and any errors.
 */
export async function syncGames(
  games: Game[],
  options: SyncOptions = {},
): Promise<SyncResult> {
  const { batchSize = 50, verbose = true } = options;
  const supabase = createSyncClient();

  const result: SyncResult = {
    source: games[0]?.source ?? 'unknown',
    attempted: games.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  if (games.length === 0) {
    if (verbose) console.log('[Sync] No games to sync');
    return result;
  }

  if (verbose) {
    console.log(`[Sync] Starting sync of ${games.length} games from ${result.source}`);
  }

  // Process in batches
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    const inserts = batch.map(gameToInsert);

    const { error } = await supabase
      .from('games')
      .upsert(inserts, { onConflict: 'source,source_id' });

    if (error) {
      // Batch failed — try individual inserts to identify which ones
      if (verbose) {
        console.warn(`[Sync] Batch ${i / batchSize + 1} failed, retrying individually: ${error.message}`);
      }

      for (const game of batch) {
        const insert = gameToInsert(game);
        const { error: individualError } = await supabase
          .from('games')
          .upsert(insert, { onConflict: 'source,source_id' });

        if (individualError) {
          result.failed++;
          result.errors.push({
            gameId: game.id,
            gameName: game.name,
            error: individualError.message,
          });
        } else {
          result.succeeded++;
        }
      }
    } else {
      result.succeeded += batch.length;
    }

    if (verbose && games.length > batchSize) {
      const progress = Math.min(i + batchSize, games.length);
      console.log(`[Sync] Progress: ${progress}/${games.length}`);
    }
  }

  if (verbose) {
    console.log(
      `[Sync] Complete: ${result.succeeded} succeeded, ${result.failed} failed out of ${result.attempted}`,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// High-Level Sync Operations
// ---------------------------------------------------------------------------

/**
 * Syncs popular/trending games from a single adapter into Supabase.
 */
export async function syncPopularFromAdapter(
  adapter: GameAdapter,
  limit: number = 50,
  options?: SyncOptions,
): Promise<SyncResult> {
  if (!adapter.getPopular) {
    return {
      source: adapter.source,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      errors: [{ gameId: '', gameName: '', error: 'Adapter does not support getPopular' }],
    };
  }

  console.log(`[Sync] Fetching popular games from ${adapter.source}...`);
  const games = await adapter.getPopular(limit);
  return syncGames(games, options);
}

/**
 * Syncs popular games from all provided adapters.
 * Returns an array of SyncResults, one per adapter.
 */
export async function syncPopularFromAll(
  adapters: GameAdapter[],
  limitPerAdapter: number = 50,
  options?: SyncOptions,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const adapter of adapters) {
    const result = await syncPopularFromAdapter(adapter, limitPerAdapter, options);
    results.push(result);
  }

  return results;
}

/**
 * Syncs games found via a search query into Supabase.
 * Useful for caching search results as users search — ensures
 * the game data is stored locally for future queries.
 */
export async function syncSearchResults(
  games: Game[],
  options?: SyncOptions,
): Promise<SyncResult> {
  return syncGames(games, { verbose: false, ...options });
}

/**
 * Fetches a single game by ID from an adapter and syncs it to Supabase.
 * Returns the synced game, or null if the adapter couldn't find it.
 */
export async function syncSingleGame(
  adapter: GameAdapter,
  sourceId: string,
): Promise<Game | null> {
  const game = await adapter.getById(sourceId);
  if (!game) return null;

  await syncGames([game], { verbose: false });
  return game;
}
