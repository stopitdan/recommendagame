/**
 * BGG Collection Sync
 *
 * Syncs a user's BGG collection into our database.
 * Matches BGG games to our game catalog, imports ratings,
 * and converts them to internal feedback signals.
 */

import { createClient } from '@supabase/supabase-js';
import { fetchBggCollection } from './user-collection';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface SyncResult {
  total: number;
  matched: number;
  rated: number;
  feedbackCreated: number;
}

/**
 * Sync a BGG user's collection to our database.
 * - Imports collection items with ratings
 * - Matches BGG IDs to our game catalog
 * - Converts BGG ratings to internal feedback (>=7 positive, <=4 negative)
 */
export async function syncBggCollection(
  userId: string,
  bggUsername: string,
): Promise<SyncResult | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  // Fetch the collection from BGG
  const collection = await fetchBggCollection(bggUsername);
  console.log(`[BGG Sync] Collection for ${bggUsername}: ${collection?.length ?? 'null'} items`);
  if (!collection) return null;

  const result: SyncResult = { total: collection.length, matched: 0, rated: 0, feedbackCreated: 0 };

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < collection.length; i += batchSize) {
    const batch = collection.slice(i, i + batchSize);
    const bggIds = batch.map((item) => `bgg-${item.bggId}`);

    // Find matching games in our DB
    const { data: matchedGames } = await supabase
      .from('games')
      .select('id, source_id')
      .in('id', bggIds);

    const matchMap = new Map(
      (matchedGames ?? []).map((g: { id: string; source_id: string }) => [g.source_id, g.id])
    );

    // Upsert collection items
    const collectionRows = batch.map((item) => ({
      user_id: userId,
      bgg_id: item.bggId,
      game_id: matchMap.get(item.bggId) ?? null,
      name: item.name,
      bgg_rating: item.rating,
      owned: item.owned,
      wishlisted: item.wishlisted,
      play_count: item.playCount,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('user_bgg_collection')
      .upsert(collectionRows, { onConflict: 'user_id,bgg_id' });

    // Count matches
    for (const item of batch) {
      if (matchMap.has(item.bggId)) result.matched++;
    }

    // Convert ratings to feedback signals
    const feedbackRows: { user_id: string; game_id: string; rating: number }[] = [];
    for (const item of batch) {
      const gameId = matchMap.get(item.bggId);
      if (!gameId || !item.rating) continue;
      result.rated++;

      // BGG rating >= 7 = positive, <= 4 = negative
      if (item.rating >= 7) {
        feedbackRows.push({ user_id: userId, game_id: gameId, rating: 1 });
      } else if (item.rating <= 4) {
        feedbackRows.push({ user_id: userId, game_id: gameId, rating: -1 });
      }
    }

    if (feedbackRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('user_game_feedback')
        .upsert(feedbackRows, { onConflict: 'user_id,game_id' })
        .select('id');
      result.feedbackCreated += (data?.length ?? 0);
    }
  }

  // Update profile with BGG username and sync timestamp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('user_profiles')
    .update({ bgg_username: bggUsername, bgg_synced_at: new Date().toISOString() })
    .eq('id', userId);

  return result;
}
