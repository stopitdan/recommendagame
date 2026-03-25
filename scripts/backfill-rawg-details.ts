/**
 * RAWG Detail Backfill — Adds descriptions, developers, and publishers.
 *
 * Built to run all night. Exponential backoff on rate limits, retries on
 * all transient errors, auto-resumes from where it left off (only fetches
 * games with empty descriptions).
 *
 * Usage: npx tsx scripts/backfill-rawg-details.ts [batchSize]
 *   Default: 5000 (run repeatedly — it picks up where it left off)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RAWG_BASE_URL = 'https://api.rawg.io/api';
const BASE_DELAY_MS = 1200;
const BATCH_LIMIT = parseInt(process.argv[2] || '5000', 10);
const MAX_RETRIES = 5;

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(30000 * Math.pow(2, attempt), 480000);
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Resilient Fetch
// ---------------------------------------------------------------------------

async function fetchWithRetry(url: string, label: string): Promise<any | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const wait = backoffMs(attempt);
        console.log(`  [${timestamp()}] [${label}] Rate limited (429), backing off ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(wait);
        continue;
      }

      if (response.status === 502 || response.status === 503 || response.status === 504) {
        const wait = backoffMs(attempt);
        console.log(`  [${timestamp()}] [${label}] Server error (${response.status}), backing off ${Math.round(wait / 1000)}s`);
        await sleep(wait);
        continue;
      }

      if (response.status === 404) {
        return null; // Game doesn't exist on RAWG
      }

      if (!response.ok) {
        console.error(`  [${timestamp()}] [${label}] HTTP ${response.status}, skipping`);
        return null;
      }

      return response.json();
    } catch (err) {
      const wait = backoffMs(attempt);
      console.error(`  [${timestamp()}] [${label}] Network error, backing off ${Math.round(wait / 1000)}s:`, (err as Error).message);
      await sleep(wait);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function backfill() {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    console.error('[Backfill] Missing RAWG_API_KEY');
    process.exit(1);
  }

  // Find RAWG games with empty descriptions
  const { data: games, error } = await supabase
    .from('games')
    .select('id, source_id, name')
    .eq('source', 'rawg')
    .eq('description', '')
    .limit(BATCH_LIMIT);

  if (error) {
    console.error('[Backfill] DB query error:', error.message);
    process.exit(1);
  }

  if (!games || games.length === 0) {
    console.log(`[${timestamp()}] [Backfill] No games need backfilling — all done!`);
    return;
  }

  console.log(`[${timestamp()}] [Backfill] Found ${games.length} RAWG games missing descriptions`);
  console.log(`[${timestamp()}] Resilient mode: ${MAX_RETRIES} retries/game, exponential backoff up to 8min`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  let consecutiveFailures = 0;

  for (const game of games) {
    const detail = await fetchWithRetry(
      `${RAWG_BASE_URL}/games/${game.source_id}?key=${apiKey}`,
      game.name,
    );

    if (!detail) {
      skipped++;
      consecutiveFailures++;

      if (consecutiveFailures >= 10) {
        console.log(`  [${timestamp()}] 10 consecutive failures, taking a 5-minute break...`);
        await sleep(300000);
        consecutiveFailures = 0;
      }

      await sleep(BASE_DELAY_MS);
      continue;
    }

    consecutiveFailures = 0;

    const updateData: Record<string, any> = {};

    if (detail.description_raw) {
      updateData.description = detail.description_raw;
    } else if (detail.description) {
      updateData.description = stripHtml(detail.description);
    }

    if (detail.developers?.length > 0) {
      updateData.developers = detail.developers.map((d: any) => d.name);
    }
    if (detail.publishers?.length > 0) {
      updateData.publishers = detail.publishers.map((p: any) => p.name);
    }
    if (detail.metacritic != null) {
      updateData.metacritic = detail.metacritic;
    }
    if (detail.esrb_rating?.name) {
      updateData.esrb_rating = detail.esrb_rating.name;
    }

    if (Object.keys(updateData).length > 0) {
      // Retry DB update
      let dbSuccess = false;
      for (let dbAttempt = 0; dbAttempt < 3; dbAttempt++) {
        const { error: updateError } = await supabase
          .from('games')
          .update(updateData)
          .eq('id', game.id);

        if (!updateError) {
          updated++;
          dbSuccess = true;
          break;
        }

        console.error(`  [${timestamp()}] [${game.name}] DB update failed (attempt ${dbAttempt + 1}): ${updateError.message}`);
        await sleep(3000);
      }

      if (!dbSuccess) failed++;
    } else {
      skipped++;
    }

    if ((updated + failed + skipped) % 50 === 0) {
      console.log(`[${timestamp()}] [Backfill] Progress: ${updated} updated | ${failed} failed | ${skipped} skipped | ${games.length - updated - failed - skipped} remaining`);
    }

    await sleep(BASE_DELAY_MS);
  }

  console.log(`\n[${timestamp()}] [Backfill] Done!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped}`);
}

backfill().catch((err) => {
  console.error(`[${timestamp()}] [Backfill] Fatal error:`, err);
  process.exit(1);
});
