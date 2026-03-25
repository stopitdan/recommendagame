/**
 * RAWG Crawler — Populates Supabase with video games from RAWG.
 *
 * Built to run all night unattended. Handles rate limits with exponential
 * backoff, retries on all transient errors, and never gives up on a page
 * until it's been retried multiple times.
 *
 * Usage: npx tsx scripts/crawl-rawg.ts [maxPages]
 *   Default: 2000 pages (~80,000 games)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RAWG_BASE_URL = 'https://api.rawg.io/api';
const PAGE_SIZE = 40;
const BASE_DELAY_MS = 1500;
const MAX_PAGES = parseInt(process.argv[2] || '2000', 10);
const MAX_RETRIES_PER_PAGE = 5;

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

/** Exponential backoff: 30s, 60s, 120s, 240s, 480s */
function backoffMs(attempt: number): number {
  return Math.min(30000 * Math.pow(2, attempt), 480000);
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function mapGame(item: any): any {
  const yearPublished = item.released ? parseInt(item.released.slice(0, 4), 10) : null;

  return {
    id: `rawg-${item.id}`,
    source: 'rawg',
    source_id: String(item.id),
    name: item.name,
    description: '',
    year_published: isNaN(yearPublished as number) ? null : yearPublished,
    types: ['video'],
    min_players: null,
    max_players: null,
    min_play_time: null,
    max_play_time: item.playtime > 0 ? item.playtime * 60 : null,
    avg_play_time: item.playtime > 0 ? item.playtime * 60 : null,
    complexity: null,
    rating: item.rating > 0 ? Math.round(item.rating * 2 * 10) / 10 : null,
    rating_count: item.ratings_count ?? 0,
    categories: (item.genres ?? []).map((g: any) => g.name),
    mechanics: [],
    themes: (item.tags ?? [])
      .filter((t: any) => t.language === 'eng')
      .map((t: any) => t.name)
      .slice(0, 20),
    platforms: (item.parent_platforms ?? []).map((p: any) => p.platform.name),
    thumbnail_url: item.background_image ?? null,
    image_url: item.background_image ?? null,
    source_url: `https://rawg.io/games/${item.slug}`,
    metacritic: item.metacritic ?? null,
    esrb_rating: item.esrb_rating?.name ?? null,
    added_count: item.added ?? null,
    suggestions_count: item.suggestions_count ?? null,
  };
}

// ---------------------------------------------------------------------------
// Resilient Fetch
// ---------------------------------------------------------------------------

async function fetchWithRetry(url: string, pageNum: number): Promise<any | null> {
  for (let attempt = 0; attempt < MAX_RETRIES_PER_PAGE; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const wait = backoffMs(attempt);
        console.log(`  [${timestamp()}] [Page ${pageNum}] Rate limited (429), backing off ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES_PER_PAGE})`);
        await sleep(wait);
        continue;
      }

      if (response.status === 502 || response.status === 503 || response.status === 504) {
        const wait = backoffMs(attempt);
        console.log(`  [${timestamp()}] [Page ${pageNum}] Server error (${response.status}), backing off ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES_PER_PAGE})`);
        await sleep(wait);
        continue;
      }

      if (!response.ok) {
        console.error(`  [${timestamp()}] [Page ${pageNum}] HTTP ${response.status}, skipping`);
        return null;
      }

      return response.json();
    } catch (err) {
      const wait = backoffMs(attempt);
      console.error(`  [${timestamp()}] [Page ${pageNum}] Network error, backing off ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES_PER_PAGE}):`, (err as Error).message);
      await sleep(wait);
    }
  }

  console.error(`  [${timestamp()}] [Page ${pageNum}] Exhausted all ${MAX_RETRIES_PER_PAGE} retries, skipping`);
  return null;
}

// ---------------------------------------------------------------------------
// Main Crawl Loop
// ---------------------------------------------------------------------------

async function crawl() {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    console.error('[RAWG Crawler] Missing RAWG_API_KEY');
    process.exit(1);
  }

  console.log(`[${timestamp()}] [RAWG Crawler] Starting: up to ${MAX_PAGES} pages (${MAX_PAGES * PAGE_SIZE} games)`);
  console.log(`[${timestamp()}] Resilient mode: ${MAX_RETRIES_PER_PAGE} retries/page, exponential backoff up to 8min`);

  let totalInserted = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let consecutiveFailures = 0;
  let page = 1;

  while (page <= MAX_PAGES) {
    const url = `${RAWG_BASE_URL}/games?key=${apiKey}&page=${page}&page_size=${PAGE_SIZE}&ordering=-rating`;

    const data = await fetchWithRetry(url, page);

    if (!data) {
      totalSkipped += PAGE_SIZE;
      consecutiveFailures++;

      // If we've failed 10 pages in a row, take a long break
      if (consecutiveFailures >= 10) {
        console.log(`  [${timestamp()}] 10 consecutive failures, taking a 5-minute break...`);
        await sleep(300000);
        consecutiveFailures = 0;
      }

      page++;
      await sleep(BASE_DELAY_MS);
      continue;
    }

    consecutiveFailures = 0;
    const results = data.results ?? [];

    if (results.length === 0) {
      console.log(`  [${timestamp()}] [Page ${page}] No more results, stopping`);
      break;
    }

    const rows = results.map(mapGame);

    // Upsert with retry on DB errors
    let dbSuccess = false;
    for (let dbAttempt = 0; dbAttempt < 3; dbAttempt++) {
      const { error } = await supabase
        .from('games')
        .upsert(rows, { onConflict: 'source,source_id' });

      if (!error) {
        totalInserted += rows.length;
        dbSuccess = true;
        break;
      }

      console.error(`  [${timestamp()}] [Page ${page}] DB error (attempt ${dbAttempt + 1}): ${error.message}`);
      await sleep(5000);
    }

    if (!dbSuccess) {
      totalFailed += rows.length;
    }

    // Progress log every 10 pages
    if (page % 10 === 0) {
      console.log(`[${timestamp()}] [RAWG] Page ${page}/${MAX_PAGES} | Inserted: ${totalInserted} | Failed: ${totalFailed} | Skipped: ${totalSkipped}`);
    }

    if (!data.next) {
      console.log(`  [${timestamp()}] No more pages available`);
      break;
    }

    page++;
    await sleep(BASE_DELAY_MS);
  }

  console.log(`\n[${timestamp()}] [RAWG Crawler] Done!`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`  Skipped: ${totalSkipped}`);
}

crawl().catch((err) => {
  console.error(`[${timestamp()}] [RAWG Crawler] Fatal error:`, err);
  process.exit(1);
});
