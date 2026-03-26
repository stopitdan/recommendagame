/**
 * IGDB Crawler
 *
 * Fetches video games from IGDB in batches and upserts into Supabase.
 * Much richer data than RAWG — proper genres, themes, keywords.
 *
 * Usage:
 *   npx tsx scripts/crawl-igdb.ts [maxGames]
 *
 * Environment:
 *   IGDB_CLIENT_ID       — Twitch Client ID
 *   IGDB_CLIENT_SECRET   — Twitch Client Secret
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Rate limits: IGDB allows 4 requests/second.
 * Each batch fetches 500 games, so 50k games = 100 requests = ~25 seconds.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { fetchIgdbBatch } from '../src/lib/adapters/igdb';
import type { Game } from '../src/types/game';

// ─── Config ──────────────────────────────────────────────────

const BATCH_SIZE = 500;
const DELAY_MS = 300; // ~3 req/sec (under 4/sec limit)
const DEFAULT_MAX_GAMES = 300_000;

// ─── Supabase ────────────────────────────────────────────────

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

function gameToRow(game: Game) {
  return {
    id: game.id,
    source: game.source,
    source_id: game.sourceId,
    name: game.name,
    description: game.description,
    year_published: game.yearPublished ?? null,
    types: game.types,
    min_players: game.playerCount?.min ?? null,
    max_players: game.playerCount?.max ?? null,
    recommended_players: game.playerCount?.recommended ?? null,
    min_play_time: game.playTime?.min ?? null,
    max_play_time: game.playTime?.max ?? null,
    avg_play_time: game.playTime?.average ?? null,
    complexity: game.complexity ?? null,
    rating: game.rating ?? null,
    rating_count: game.ratingCount ?? 0,
    categories: game.categories,
    mechanics: game.mechanics,
    themes: game.themes,
    platforms: game.platforms,
    thumbnail_url: game.thumbnailUrl ?? null,
    image_url: game.imageUrl ?? null,
    source_url: game.sourceUrl ?? null,
  };
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const maxGames = parseInt(process.argv[2] ?? String(DEFAULT_MAX_GAMES), 10);

  console.log(`[IGDB Crawler] Starting — target: ${maxGames} games`);
  console.log(`[IGDB Crawler] Batch size: ${BATCH_SIZE}, delay: ${DELAY_MS}ms`);

  const supabase = createDbClient();
  let totalInserted = 0;
  let offset = 0;
  let emptyBatches = 0;

  while (totalInserted < maxGames && emptyBatches < 3) {
    const batch = await fetchIgdbBatch(offset, BATCH_SIZE);

    if (batch.length === 0) {
      emptyBatches++;
      console.log(`[IGDB Crawler] Empty batch at offset ${offset} (${emptyBatches}/3 before stopping)`);
      offset += BATCH_SIZE;
      continue;
    }

    emptyBatches = 0;
    const rows = batch.map(gameToRow);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('games')
      .upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: false });

    if (error) {
      console.error(`[IGDB Crawler] Upsert error at offset ${offset}:`, error.message);
    } else {
      totalInserted += batch.length;
      console.log(`[IGDB Crawler] +${batch.length} games (total: ${totalInserted}, offset: ${offset})`);
    }

    offset += BATCH_SIZE;

    // Rate limit
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`\n[IGDB Crawler] Done! Inserted ${totalInserted} games.`);
}

main().catch((err) => {
  console.error('[IGDB Crawler] Fatal error:', err);
  process.exit(1);
});
