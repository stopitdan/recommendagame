/**
 * Generate embeddings for all games in the database.
 *
 * Reads games from Supabase, computes 768-dim vectors using our
 * attribute-based encoder, and upserts them into game_embeddings.
 *
 * Usage:
 *   npx tsx scripts/generate-embeddings.ts [batch-size] [start-offset]
 *
 * Default batch size is 200 (how many games to process per DB call).
 * Optional start-offset skips ahead (e.g. 84000 to resume from that point).
 * Safe to re-run — uses upsert so existing embeddings get updated.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// Import from source (tsx handles TS compilation)
import { gameToVector, normalize, VECTOR_DIM } from '../src/lib/recommendation/embeddings';
import { rowToGame } from '../src/lib/supabase/games';
import type { GameRow } from '../src/types/supabase';

const BATCH_SIZE = parseInt(process.argv[2] ?? '200', 10);
const START_OFFSET = parseInt(process.argv[3] ?? '0', 10);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  console.log(`[Embeddings] Starting generation (batch size: ${BATCH_SIZE}, offset: ${START_OFFSET})`);

  let offset = START_OFFSET;
  let totalProcessed = 0;
  let totalUpserted = 0;
  let totalFailed = 0;

  while (true) {
    // Fetch a batch of games
    const { data: rows, error } = await supabase
      .from('games')
      .select('*')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id');

    if (error) {
      console.error('[Embeddings] Fetch error:', error.message);
      break;
    }

    if (!rows || rows.length === 0) {
      console.log('[Embeddings] No more games to process');
      break;
    }

    // Check which games already have hash embeddings (skip them)
    const gameIds = (rows as GameRow[]).map((r) => r.id);
    const { data: existingRows } = await supabase
      .from('game_embeddings')
      .select('game_id')
      .in('game_id', gameIds)
      .not('embedding', 'is', null);

    const existingIds = new Set((existingRows ?? []).map((r: { game_id: string }) => r.game_id));
    const newRows = (rows as GameRow[]).filter((r) => !existingIds.has(r.id));

    if (newRows.length === 0) {
      totalProcessed += rows.length;
      offset += BATCH_SIZE;
      if (totalProcessed % 2000 === 0) {
        console.log(`[Embeddings] Progress: ${totalProcessed} processed | ${totalUpserted} upserted | ${totalFailed} failed (all had embeddings)`);
      }
      continue;
    }

    // Generate embeddings
    const embeddings = newRows.map((row) => {
      const game = rowToGame(row);
      const vector = normalize(gameToVector(game));
      return {
        game_id: game.id,
        embedding: `[${vector.join(',')}]`,
        model_version: 'attribute-v1',
      };
    });

    // Upsert one at a time with retries (HNSW index causes timeouts at scale)
    for (const emb of embeddings) {
      let success = false;

      for (let attempt = 0; attempt < 3; attempt++) {
        const { error: upsertError } = await supabase
          .from('game_embeddings')
          .upsert(emb, { onConflict: 'game_id' });

        if (!upsertError) {
          totalUpserted++;
          success = true;
          break;
        }

        console.warn(`[Embeddings] Retry ${attempt + 1}/3 for ${emb.game_id}: ${upsertError.message}`);
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }

      if (!success) {
        console.error(`[Embeddings] Failed after 3 retries: ${emb.game_id}`);
        totalFailed++;
      }

      // Small delay between rows to reduce HNSW index pressure
      await new Promise((r) => setTimeout(r, 50));
    }

    totalProcessed += rows.length;
    offset += BATCH_SIZE;

    if (totalProcessed % 2000 === 0 || rows.length < BATCH_SIZE) {
      console.log(`[Embeddings] Progress: ${totalProcessed} processed | ${totalUpserted} upserted | ${totalFailed} failed`);
    }

    // Small delay to avoid hammering the DB
    if (rows.length === BATCH_SIZE) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log(`\n[Embeddings] Done!`);
  console.log(`  Total processed: ${totalProcessed}`);
  console.log(`  Total upserted: ${totalUpserted}`);
  console.log(`  Total failed: ${totalFailed}`);
}

main().catch(console.error);
