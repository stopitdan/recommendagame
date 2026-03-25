/**
 * BGG Crawler — Populates Supabase with board games from BoardGameGeek.
 *
 * Strategy: BGG game IDs are roughly sequential (1 to ~400,000+).
 * We batch 20 IDs per /thing request, waiting 5s between requests
 * to respect rate limits. Each request takes ~5-7s total.
 *
 * Rate: ~20 games every 6 seconds = ~12,000 games/hour
 *
 * Usage: npx tsx scripts/crawl-bgg.ts [startId] [endId]
 *   Default: starts at 1, goes to 50000
 */

import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BGG_BASE_URL = 'https://boardgamegeek.com/xmlapi2';
const USER_AGENT = 'RecommendAGame/1.0 (https://recommendagame.com)';
const BATCH_SIZE = 20;
const THROTTLE_MS = 5500; // 5.5s to be safe
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

const START_ID = parseInt(process.argv[2] || '1', 10);
const END_ID = parseInt(process.argv[3] || '50000', 10);

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---------------------------------------------------------------------------
// XML Parser
// ---------------------------------------------------------------------------

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['item', 'name', 'link', 'poll', 'results', 'result'].includes(name),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#10;/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function parseOptionalInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseOptionalFloat(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

function extractLinks(links: any[], type: string): string[] {
  return links.filter((l: any) => l['@_type'] === type).map((l: any) => l['@_value']);
}

// ---------------------------------------------------------------------------
// Fetch + Parse
// ---------------------------------------------------------------------------

async function fetchBgg(url: string): Promise<string | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
      const bggToken = process.env.BGG_API_TOKEN;
      if (bggToken) {
        headers['Authorization'] = `Bearer ${bggToken}`;
      }

      const response = await fetch(url, { headers });

      if (response.status === 202) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      if (response.status === 429) {
        console.log('  Rate limited, waiting 30s...');
        await sleep(30000);
        continue;
      }

      if (!response.ok) return null;
      return response.text();
    } catch {
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return null;
    }
  }
  return null;
}

function mapItem(item: any): any | null {
  if (item['@_type'] !== 'boardgame') return null;

  const names = ensureArray(item.name);
  const links = ensureArray(item.link);
  const primaryName = names.find((n: any) => n['@_type'] === 'primary');
  const name = primaryName?.['@_value'] ?? names[0]?.['@_value'];
  if (!name) return null;

  const id = item['@_id'];

  return {
    id: `bgg-${id}`,
    source: 'bgg',
    source_id: id,
    name,
    description: stripHtml(item.description ?? ''),
    year_published: parseOptionalInt(item.yearpublished?.['@_value']),
    types: ['board'],
    min_players: parseOptionalInt(item.minplayers?.['@_value']),
    max_players: parseOptionalInt(item.maxplayers?.['@_value']),
    min_play_time: parseOptionalInt(item.minplaytime?.['@_value']),
    max_play_time: parseOptionalInt(item.maxplaytime?.['@_value']),
    avg_play_time: parseOptionalInt(item.playingtime?.['@_value']),
    complexity: parseOptionalFloat(item.statistics?.ratings?.averageweight?.['@_value']),
    rating: parseOptionalFloat(item.statistics?.ratings?.average?.['@_value']),
    rating_count: parseOptionalInt(item.statistics?.ratings?.usersrated?.['@_value']),
    categories: extractLinks(links, 'boardgamecategory'),
    mechanics: extractLinks(links, 'boardgamemechanic'),
    themes: extractLinks(links, 'boardgamefamily'),
    platforms: [],
    thumbnail_url: item.thumbnail ?? null,
    image_url: item.image ?? null,
    source_url: `https://boardgamegeek.com/boardgame/${id}`,
  };
}

// ---------------------------------------------------------------------------
// Main Crawl Loop
// ---------------------------------------------------------------------------

async function crawl() {
  console.log(`[BGG Crawler] Starting: IDs ${START_ID} to ${END_ID}`);
  console.log(`[BGG Crawler] Batch size: ${BATCH_SIZE}, throttle: ${THROTTLE_MS}ms`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (let id = START_ID; id <= END_ID; id += BATCH_SIZE) {
    const batchEnd = Math.min(id + BATCH_SIZE - 1, END_ID);
    const ids = Array.from({ length: batchEnd - id + 1 }, (_, i) => String(id + i));

    const url = `${BGG_BASE_URL}/thing?id=${ids.join(',')}&stats=1`;
    const xml = await fetchBgg(url);

    if (!xml) {
      totalFailed += ids.length;
      console.log(`  [${id}-${batchEnd}] Fetch failed`);
    } else {
      const parsed = xmlParser.parse(xml);
      const items = ensureArray(parsed?.items?.item);
      const rows = items.map(mapItem).filter(Boolean);

      if (rows.length > 0) {
        const { error } = await supabase
          .from('games')
          .upsert(rows, { onConflict: 'source,source_id' });

        if (error) {
          console.error(`  [${id}-${batchEnd}] DB error: ${error.message}`);
          totalFailed += rows.length;
        } else {
          totalInserted += rows.length;
        }
      }

      totalSkipped += ids.length - items.length;
    }

    // Progress log every 10 batches
    if (Math.floor((id - START_ID) / BATCH_SIZE) % 10 === 0) {
      console.log(
        `[BGG] Progress: ID ${id}/${END_ID} | Inserted: ${totalInserted} | Skipped: ${totalSkipped} | Failed: ${totalFailed}`,
      );
    }

    await sleep(THROTTLE_MS);
  }

  console.log(`\n[BGG Crawler] Done!`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log(`  Failed: ${totalFailed}`);
}

crawl().catch(console.error);
