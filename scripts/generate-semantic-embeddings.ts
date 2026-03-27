/**
 * Generate semantic embeddings for all games using OpenAI.
 *
 * Uses text-embedding-3-small (1536 dims) to encode game name,
 * description, categories, mechanics, and themes into a semantic
 * vector. Cost: ~$0.40 for 100k games.
 *
 * Usage:
 *   npx tsx scripts/generate-semantic-embeddings.ts [batch-size] [start-offset]
 *
 * Resumable — tracks progress via offset. If interrupted, re-run
 * with the last logged offset to continue.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { rowToGame } from '../src/lib/supabase/games';
import { gameToText, embedBatch } from '../src/lib/recommendation/semantic-embeddings';
import type { GameRow } from '../src/types/supabase';

const BATCH_SIZE = parseInt(process.argv[2] ?? '100', 10);
const START_OFFSET = parseInt(process.argv[3] ?? '0', 10);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  console.log(`[Semantic Embeddings] Starting (batch: ${BATCH_SIZE}, offset: ${START_OFFSET})`);

  let offset = START_OFFSET;
  let totalProcessed = 0;
  let totalUpserted = 0;
  let totalSkipped = 0;

  while (true) {
    // Fetch games ordered by ID with pagination
    const { data: rows, error } = await supabase
      .from('games')
      .select('*')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id');

    if (error) {
      console.error('[Semantic] Fetch error:', error.message);
      break;
    }

    if (!rows || rows.length === 0) {
      console.log('[Semantic] No more games to process');
      break;
    }

    // Convert to Game objects and build text representations
    const games = (rows as GameRow[]).map(rowToGame);

    // Check which games already have semantic embeddings (skip them)
    const gameIds = games.map((g) => g.id);
    const { data: existingRows } = await supabase
      .from('game_embeddings')
      .select('game_id')
      .in('game_id', gameIds)
      .not('semantic_embedding', 'is', null);

    const existingIds = new Set((existingRows ?? []).map((r) => r.game_id));
    const gamesToEmbed = games.filter((g) => !existingIds.has(g.id));

    if (gamesToEmbed.length === 0) {
      totalProcessed += rows.length;
      totalSkipped += rows.length;
      offset += BATCH_SIZE;
      console.log(`[Semantic] Progress: ${totalProcessed} processed | ${totalUpserted} upserted | ${totalSkipped} skipped | offset: ${offset} (all had embeddings)`);
      continue;
    }

    const texts = gamesToEmbed.map(gameToText);

    // Generate embeddings via OpenAI batch API
    const embeddings = await embedBatch(texts);

    // Build upsert rows (skip games where embedding failed)
    const upsertRows: { game_id: string; semantic_embedding: string; semantic_model: string }[] = [];

    for (let i = 0; i < gamesToEmbed.length; i++) {
      if (embeddings[i]) {
        upsertRows.push({
          game_id: gamesToEmbed[i].id,
          semantic_embedding: `[${embeddings[i]!.join(',')}]`,
          semantic_model: 'text-embedding-3-small',
        });
      } else {
        totalSkipped++;
      }
    }

    if (upsertRows.length > 0) {
      // Upsert one row at a time with retries to avoid HNSW index timeouts
      for (let i = 0; i < upsertRows.length; i++) {
        const row = upsertRows[i];
        let success = false;

        for (let attempt = 0; attempt < 3; attempt++) {
          const { error: upsertError } = await supabase
            .from('game_embeddings')
            .upsert(row, { onConflict: 'game_id' });

          if (!upsertError) {
            totalUpserted++;
            success = true;
            break;
          }

          // On timeout, wait longer before retrying
          console.warn(`[Semantic] Retry ${attempt + 1}/3 for ${row.game_id}: ${upsertError.message}`);
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }

        if (!success) {
          console.error(`[Semantic] Failed after 3 retries: ${row.game_id}`);
        }

        // Small delay between individual upserts to reduce index pressure
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    totalProcessed += rows.length;
    offset += BATCH_SIZE;

    console.log(`[Semantic] Progress: ${totalProcessed} processed | ${totalUpserted} upserted | ${totalSkipped} skipped | offset: ${offset}`);

    // Rate limit — OpenAI embedding API is fast but let's be safe
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n[Semantic] Done!`);
  console.log(`  Processed: ${totalProcessed}`);
  console.log(`  Upserted:  ${totalUpserted}`);
  console.log(`  Skipped:   ${totalSkipped}`);
}

main().catch(console.error);
