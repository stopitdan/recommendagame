/**
 * Steam Library Sync
 *
 * Syncs a user's Steam library into our database.
 * Matches Steam games to our catalog by name (fuzzy) since
 * RAWG/IGDB games don't store Steam app IDs directly.
 *
 * Follows the same pattern as src/lib/bgg/sync.ts.
 */

import { createClient } from '@supabase/supabase-js';
import { fetchSteamLibrary, resolveSteamId } from './user-library';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface SteamSyncResult {
  total: number;
  matched: number;
  imported: number;
}

/**
 * Sync a Steam user's library to our database.
 * - Resolves vanity URL/profile link to Steam64 ID
 * - Fetches owned games
 * - Matches by name to our game catalog (video games)
 * - Inserts into user_owned_games with source='steam'
 */
export async function syncSteamLibrary(
  userId: string,
  steamInput: string,
): Promise<SteamSyncResult | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  // Resolve to Steam64 ID
  const steamId = await resolveSteamId(steamInput);
  if (!steamId) return null;

  // Fetch library
  const library = await fetchSteamLibrary(steamId);
  console.log(`[Steam Sync] Library for ${steamId}: ${library?.length ?? 'null'} games`);
  if (!library || library.length === 0) return null;

  const result: SteamSyncResult = { total: library.length, matched: 0, imported: 0 };

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < library.length; i += batchSize) {
    const batch = library.slice(i, i + batchSize);
    const names = batch.map((g) => g.name.toLowerCase());

    // Search for matching games in our DB by name (video games only)
    // Use ilike for case-insensitive matching
    const ownedRows: { user_id: string; game_id: string; source: string }[] = [];

    for (const steamGame of batch) {
      // Try exact name match first (case-insensitive)
      const { data: matches } = await supabase
        .from('games')
        .select('id, name')
        .ilike('name', steamGame.name)
        .contains('types', ['video'])
        .limit(1);

      if (matches && matches.length > 0) {
        result.matched++;
        ownedRows.push({
          user_id: userId,
          game_id: (matches[0] as { id: string }).id,
          source: 'steam',
        });
      }
    }

    if (ownedRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_owned_games')
        .upsert(ownedRows, { onConflict: 'user_id,game_id' })
        .select('game_id');
      result.imported += data?.length ?? 0;
    }
  }

  return result;
}
