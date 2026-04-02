/**
 * Train BPR Model
 *
 * Fetches user feedback from Supabase (user_game_feedback table),
 * trains a BPR model, and stores the serialized model in Redis
 * (or a Supabase table) for inference.
 *
 * Designed to run nightly as a cron job.
 *
 * Usage: npx tsx scripts/train-bpr.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { BPRModel, type FeedbackEntry } from '../src/lib/recommendation/bpr';
import * as fs from 'fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MODEL_PATH = 'scripts/bpr-model.json';

async function main() {
  console.log('[BPR] Fetching feedback data...');

  // Fetch all user feedback
  const { data: feedback, error } = await supabase
    .from('user_game_feedback')
    .select('user_id, game_id, rating')
    .limit(100000);

  if (error) {
    console.error('[BPR] Fetch error:', error.message);
    return;
  }

  if (!feedback || feedback.length === 0) {
    console.log('[BPR] No feedback data found. Need user interactions before training.');
    return;
  }

  console.log(`[BPR] Found ${feedback.length} feedback entries`);

  // Convert to FeedbackEntry format
  const entries: FeedbackEntry[] = feedback
    .filter((f: any) => f.rating === 1 || f.rating === -1)
    .map((f: any) => ({
      userId: f.user_id,
      gameId: f.game_id,
      rating: f.rating as 1 | -1,
    }));

  const uniqueUsers = new Set(entries.map(e => e.userId));
  const uniqueItems = new Set(entries.map(e => e.gameId));

  console.log(`[BPR] ${entries.length} valid entries from ${uniqueUsers.size} users across ${uniqueItems.size} games`);

  if (uniqueUsers.size < 3) {
    console.log('[BPR] Not enough users for meaningful collaborative filtering (need >= 3)');
    return;
  }

  // Train
  console.log('[BPR] Training model (64 factors, 50 epochs)...');
  const model = new BPRModel({ factors: 64, epochs: 50, lr: 0.01, reg: 0.01, negSamples: 5 });

  model.train(entries, (epoch, loss) => {
    if (epoch % 10 === 0 || epoch === 1) {
      console.log(`  Epoch ${epoch}: loss = ${loss.toFixed(6)}`);
    }
  });

  console.log(`[BPR] Training complete. Users: ${model.userCount}, Items: ${model.itemCount}`);

  // Serialize and save
  const json = model.serialize();
  fs.writeFileSync(MODEL_PATH, json);
  console.log(`[BPR] Model saved to ${MODEL_PATH} (${(json.length / 1024).toFixed(0)} KB)`);

  // Also try to store in Supabase for API access
  // (optional -- falls back to file if table doesn't exist)
  try {
    const { error: storeError } = await supabase
      .from('ml_models')
      .upsert({
        model_name: 'bpr',
        model_data: json,
        trained_at: new Date().toISOString(),
        metadata: {
          users: model.userCount,
          items: model.itemCount,
          feedbackCount: entries.length,
          config: { factors: 64, epochs: 50, lr: 0.01, reg: 0.01 },
        },
      }, { onConflict: 'model_name' });

    if (storeError) {
      console.log(`[BPR] Could not store in Supabase (table may not exist): ${storeError.message}`);
      console.log('[BPR] Model is saved locally at', MODEL_PATH);
    } else {
      console.log('[BPR] Model stored in Supabase ml_models table');
    }
  } catch {
    console.log('[BPR] Supabase storage skipped (ml_models table not set up)');
  }
}

main().catch(console.error);
