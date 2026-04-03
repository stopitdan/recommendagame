/**
 * Fix Gibberish Descriptions
 *
 * ~7k games have lemmatized descriptions from the original Kaggle import
 * (stop words removed, reads like keyword soup). This script identifies
 * them and re-fetches real descriptions from BGG's XML API.
 *
 * Detection: real English descriptions contain "the", "a", "is", etc.
 * Gibberish ones don't (e.g., "pente abstract strategy game player place").
 *
 * Usage: npx tsx scripts/fix-gibberish-descriptions.ts [start-offset]
 *
 * Runtime: ~30 min for 7k games (5.5s throttle between BGG API calls)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';

const START_OFFSET = parseInt(process.argv[2] ?? '0', 10);
const BGG_BATCH_SIZE = 20; // BGG allows up to 20 IDs per /thing request
const THROTTLE_MS = 5500;  // 5.5s between requests (BGG rate limit ~5s)
const FETCH_BATCH = 500;   // How many gibberish games to fetch from DB at a time

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BGG_TOKEN = process.env.BGG_API_KEY;
if (!BGG_TOKEN) {
  console.error('Missing BGG_API_KEY in .env.local');
  process.exit(1);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ts(): string {
  return new Date().toLocaleTimeString();
}

function stripHtml(html: string): string {
  return html
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchDescriptions(bggIds: string[]): Promise<Map<string, string>> {
  const idsParam = bggIds.join(',');
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${idsParam}&stats=0`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${BGG_TOKEN}` },
  });
  if (res.status === 202) {
    // BGG says "queued, try again"
    console.log(`  [${ts()}] BGG returned 202 (queued), retrying in 10s...`);
    await sleep(10000);
    return fetchDescriptions(bggIds);
  }
  if (res.status === 429) {
    console.log(`  [${ts()}] Rate limited (429), waiting 30s...`);
    await sleep(30000);
    return fetchDescriptions(bggIds);
  }
  if (!res.ok) {
    console.error(`  [${ts()}] BGG API error: ${res.status}`);
    return new Map();
  }

  const xml = await res.text();
  const parsed = parser.parse(xml);
  const items = Array.isArray(parsed.items?.item)
    ? parsed.items.item
    : parsed.items?.item ? [parsed.items.item] : [];

  const results = new Map<string, string>();
  for (const item of items) {
    const id = String(item['@_id']);
    const desc = stripHtml(item.description ?? '');
    if (desc.length > 20) {
      results.set(id, desc);
    }
  }
  return results;
}

async function main() {
  console.log(`[${ts()}] Finding games with gibberish descriptions...`);

  // Rough count of candidates to check (actual gibberish is a subset)
  const { count } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'bgg')
    .not('description', 'is', null)
    .not('description', 'like', '% the %')
    .gt('description', '');

  console.log(`[${ts()}] ~${count ?? '?'} candidates to check (filtering client-side for actual gibberish)`);
  console.log(`[${ts()}] BGG batch size: ${BGG_BATCH_SIZE}, throttle: ${THROTTLE_MS}ms`);
  if (START_OFFSET > 0) console.log(`[${ts()}] Starting from offset: ${START_OFFSET}`);
  console.log();

  let offset = START_OFFSET;
  let totalFixed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  while (true) {
    // Fetch a batch of games to check for gibberish client-side.
    // We can't do the multi-marker heuristic in PostgREST, so fetch and filter.
    const { data: rows, error } = await supabase
      .from('games')
      .select('id, source_id, name, description')
      .eq('source', 'bgg')
      .not('description', 'is', null)
      .not('description', 'like', '% the %')
      .gt('description', '')
      .order('rating_count', { ascending: false, nullsFirst: false })
      .range(offset, offset + FETCH_BATCH - 1);

    if (error) {
      console.error(`[${ts()}] DB error:`, error.message);
      break;
    }
    if (!rows || rows.length === 0) {
      console.log(`[${ts()}] No more games to check.`);
      break;
    }

    // Client-side gibberish detection: real English has common articles/prepositions.
    // Lemmatized text strips them out. Count how many markers are present.
    const MARKERS = [' the ', ' a ', ' an ', ' is ', ' are ', ' of ', ' in ', ' for ', ' and ', ' to ', ' with ', ' that '];
    const gibberishRows = rows.filter((r) => {
      const d = (r.description ?? '').toLowerCase();
      if (d.length <= 50) return false; // too short to judge
      const found = MARKERS.filter((m) => d.includes(m)).length;
      return found <= 1; // 0-1 common words = almost certainly gibberish
    });

    if (gibberishRows.length === 0) {
      offset += rows.length;
      console.log(`[${ts()}] Batch had 0 gibberish out of ${rows.length} (offset ${offset})`);
      continue;
    }

    console.log(`[${ts()}] Found ${gibberishRows.length} gibberish out of ${rows.length} (offset ${offset})`);

    // Process in BGG-sized chunks
    for (let i = 0; i < gibberishRows.length; i += BGG_BATCH_SIZE) {
      const chunk = gibberishRows.slice(i, i + BGG_BATCH_SIZE);
      const bggIds = chunk.map((r) => r.source_id);

      const descriptions = await fetchDescriptions(bggIds);

      // Update each game that got a real description back
      for (const row of chunk) {
        const newDesc = descriptions.get(row.source_id);
        if (newDesc) {
          const { error: updateError } = await supabase
            .from('games')
            .update({ description: newDesc })
            .eq('id', row.id);

          if (updateError) {
            totalFailed++;
          } else {
            totalFixed++;
          }
        } else {
          totalSkipped++;
        }
      }

      const pct = count ? ((offset + i + chunk.length) / count * 100).toFixed(1) : '?';
      console.log(`  [${ts()}] ${totalFixed} fixed, ${totalSkipped} skipped, ${totalFailed} failed | ${pct}% done`);

      await sleep(THROTTLE_MS);
    }

    offset += rows.length;
  }

  console.log();
  console.log(`[${ts()}] Done!`);
  console.log(`  Fixed:   ${totalFixed}`);
  console.log(`  Skipped: ${totalSkipped} (BGG returned no/short description)`);
  console.log(`  Failed:  ${totalFailed} (DB update errors)`);
}

main().catch(console.error);
