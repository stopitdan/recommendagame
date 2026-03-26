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
    // Fetch games that DON'T have semantic embeddings yet
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
    const texts = games.map(gameToText);

    // Generate embeddings via OpenAI batch API
    const embeddings = await embedBatch(texts);

    // Build upsert rows (skip games where embedding failed)
    const upsertRows: { game_id: string; semantic_embedding: string; semantic_model: string }[] = [];

    for (let i = 0; i < games.length; i++) {
      if (embeddings[i]) {
        upsertRows.push({
          game_id: games[i].id,
          semantic_embedding: `[${embeddings[i]!.join(',')}]`,
          semantic_model: 'text-embedding-3-small',
        });
      } else {
        totalSkipped++;
      }
    }

    if (upsertRows.length > 0) {
      // Upsert in smaller sub-batches to avoid timeout
      const SUB_BATCH = 25;
      for (let i = 0; i < upsertRows.length; i += SUB_BATCH) {
        const chunk = upsertRows.slice(i, i + SUB_BATCH);
        const { error: upsertError } = await supabase
          .from('game_embeddings')
          .upsert(chunk, { onConflict: 'game_id' });

        if (upsertError) {
          console.error(`[Semantic] Upsert error at offset ${offset}:`, upsertError.message);
        } else {
          totalUpserted += chunk.length;
        }
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
