/**
 * BGG XML API2 Crawler
 *
 * Scans BGG game IDs sequentially, fetching full game details with stats
 * and upserting into Supabase. Uses the BGG Bearer token for auth.
 *
 * Strategy: BGG IDs are sequential integers. We batch 20 IDs per request
 * (the max for /thing), wait 6 seconds between requests to stay well under
 * the rate limit, and retry with exponential backoff on failures.
 *
 * Usage:
 *   npx tsx scripts/crawl-bgg-api.ts [startId] [endId]
 *   npx tsx scripts/crawl-bgg-api.ts 1 50000
 *
 * The crawler:
 * - Fetches real HTML descriptions (replaces Kaggle's lemmatized garbage)
 * - Gets full stats (ratings, complexity, rankings)
 * - Gets categories, mechanics, families, designers
 * - Gets suggested player count polls (best/recommended)
 * - Respects rate limits with 6s minimum between requests
 * - Exponential backoff on 429/5xx errors (30s → 60s → 120s → 240s → 480s)
 * - Survives overnight runs without dying
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';

// ─── Config ──────────────────────────────────────────────────

const BGG_BASE_URL = 'https://boardgamegeek.com/xmlapi2';
const BATCH_SIZE = 20;        // Max IDs per /thing request
const THROTTLE_MS = 6000;     // 6 seconds between requests (safe margin)
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 30000; // 30 seconds initial backoff
const PROGRESS_INTERVAL = 100; // Log every N games

const START_ID = parseInt(process.argv[2] ?? '1', 10);
const END_ID = parseInt(process.argv[3] ?? '400000', 10);

// ─── Clients ─────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bggToken = process.env.BGG_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!bggToken) {
  console.error('Missing BGG_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) =>
    ['item', 'name', 'link', 'poll', 'results', 'result', 'rank'].includes(name),
});

// ─── Helpers ─────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp(): string {
  return `[${new Date().toLocaleTimeString()}]`;
}

function stripHtml(html: string): string {
  return html
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ensureArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function optInt(val: string | number | undefined): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = typeof val === 'number' ? val : parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function optFloat(val: string | number | undefined): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(n) ? null : n;
}

// ─── Fetch with retry + backoff ──────────────────────────────

let consecutiveFailures = 0;

async function fetchBgg(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'RecommendAGame/1.0',
          'Authorization': `Bearer ${bggToken}`,
        },
      });

      if (response.status === 202) {
        // BGG is queueing the request — wait and retry
        console.log(`${timestamp()} 202 received, retrying in 3s...`);
        await sleep(3000);
        continue;
      }

      if (response.status === 429 || response.status >= 500) {
        // Rate limited or server error — exponential backoff
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
        console.log(`${timestamp()} HTTP ${response.status}, backing off ${backoff / 1000}s`);
        await sleep(backoff);
        consecutiveFailures++;
        continue;
      }

      if (!response.ok) {
        return null;
      }

      consecutiveFailures = 0;
      return await response.text();
    } catch (err) {
      const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
      console.log(`${timestamp()} Fetch error, backing off ${backoff / 1000}s: ${err}`);
      await sleep(backoff);
      consecutiveFailures++;
    }
  }

  return null;
}

// ─── Parse BGG /thing XML → DB row ──────────────────────────

interface GameRow {
  id: string;
  source: string;
  source_id: string;
  name: string;
  description: string;
  year_published: number | null;
  types: string[];
  min_players: number | null;
  max_players: number | null;
  recommended_players: number | null;
  min_play_time: number | null;
  max_play_time: number | null;
  avg_play_time: number | null;
  complexity: number | null;
  rating: number | null;
  rating_count: number | null;
  categories: string[];
  mechanics: string[];
  themes: string[];
  platforms: string[];
  thumbnail_url: string | null;
  image_url: string | null;
  source_url: string;
  // Extended BGG fields
  bayes_avg_rating: number | null;
  rating_stddev: number | null;
  mfg_age_rec: number | null;
  best_players: string | null;
  good_players: string[];
  num_owned: number | null;
  num_want: number | null;
  num_wish: number | null;
  num_comments: number | null;
  rank_overall: number | null;
  rank_strategy: number | null;
  rank_family: number | null;
  rank_party: number | null;
  rank_abstract: number | null;
  rank_thematic: number | null;
  rank_wargame: number | null;
  rank_cgs: number | null;
  rank_childrens: number | null;
  designers: string[];
  artists: string[];
  family: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseItem(item: any): GameRow | null {
  if (!item || item['@_type'] !== 'boardgame') return null;

  const bggId = item['@_id'];
  const names = ensureArray(item.name);
  const links = ensureArray(item.link);
  const polls = ensureArray(item.poll);

  const primaryName = names.find((n: any) => n['@_type'] === 'primary');
  const name = primaryName?.['@_value'] ?? names[0]?.['@_value'];
  if (!name) return null;

  // Description: real HTML from the API
  const description = stripHtml(item.description ?? '');

  // Extract link types
  const extractLinks = (type: string): string[] =>
    links.filter((l: any) => l['@_type'] === type).map((l: any) => l['@_value']);

  const categories = extractLinks('boardgamecategory');
  const mechanics = extractLinks('boardgamemechanic');
  const families = extractLinks('boardgamefamily');
  const designers = extractLinks('boardgamedesigner');
  const artists = extractLinks('boardgameartist');

  // Stats
  const stats = item.statistics?.ratings;
  const rating = optFloat(stats?.average?.['@_value']);
  const bayesAvg = optFloat(stats?.bayesaverage?.['@_value']);
  const ratingCount = optInt(stats?.usersrated?.['@_value']);
  const stddev = optFloat(stats?.stddev?.['@_value']);
  const complexity = optFloat(stats?.averageweight?.['@_value']);
  const owned = optInt(stats?.owned?.['@_value']);
  const wanting = optInt(stats?.wanting?.['@_value']);
  const wishing = optInt(stats?.wishing?.['@_value']);
  const numComments = optInt(stats?.numcomments?.['@_value']);

  // Rankings
  const ranks = ensureArray(stats?.ranks?.rank);
  const getRank = (name: string): number | null => {
    const rank = ranks.find((r: any) => r['@_name'] === name);
    const val = optInt(rank?.['@_value']);
    return val && val > 0 ? val : null;
  };

  // Suggested player count poll
  const suggestedPoll = polls.find((p: any) => p['@_name'] === 'suggested_numplayers');
  let bestPlayers: string | null = null;
  const goodPlayers: string[] = [];
  let recommendedPlayerCount: number | null = null;

  if (suggestedPoll) {
    const allResults = ensureArray(suggestedPoll.results);
    let bestVotes = 0;

    for (const results of allResults) {
      const numPlayers = results['@_numplayers'];
      if (!numPlayers) continue;

      const votes = ensureArray(results.result);
      const bestOption = votes.find((v: any) => v['@_value'] === 'Best');
      const recOption = votes.find((v: any) => v['@_value'] === 'Recommended');
      const notRecOption = votes.find((v: any) => v['@_value'] === 'Not Recommended');

      const bestV = parseInt(bestOption?.['@_numvotes'] ?? '0', 10);
      const recV = parseInt(recOption?.['@_numvotes'] ?? '0', 10);
      const notRecV = parseInt(notRecOption?.['@_numvotes'] ?? '0', 10);

      // "Good" if Best + Recommended > Not Recommended
      if (bestV + recV > notRecV) {
        goodPlayers.push(numPlayers);
      }

      // Track the "Best" player count
      if (bestV > bestVotes) {
        bestVotes = bestV;
        bestPlayers = numPlayers;
        const parsed = parseInt(numPlayers, 10);
        if (!isNaN(parsed)) recommendedPlayerCount = parsed;
      }
    }
  }

  // Suggested age poll
  const agePoll = polls.find((p: any) => p['@_name'] === 'suggested_playerage');
  let communityAge: number | null = null;
  if (agePoll) {
    const ageResults = ensureArray(agePoll.results);
    if (ageResults.length > 0) {
      const votes = ensureArray(ageResults[0].result);
      let maxVotes = 0;
      for (const v of votes) {
        const n = parseInt(v['@_numvotes'] ?? '0', 10);
        if (n > maxVotes) {
          maxVotes = n;
          communityAge = parseInt(v['@_value'] ?? '0', 10) || null;
        }
      }
    }
  }

  // First family name (for game series grouping)
  const familyName = families.length > 0 ? families[0] : null;

  return {
    id: `bgg-${bggId}`,
    source: 'bgg',
    source_id: bggId,
    name,
    description,
    year_published: optInt(item.yearpublished?.['@_value']),
    types: ['board'],
    min_players: optInt(item.minplayers?.['@_value']),
    max_players: optInt(item.maxplayers?.['@_value']),
    recommended_players: recommendedPlayerCount,
    min_play_time: optInt(item.minplaytime?.['@_value']),
    max_play_time: optInt(item.maxplaytime?.['@_value']),
    avg_play_time: optInt(item.playingtime?.['@_value']),
    complexity,
    rating,
    rating_count: ratingCount,
    categories,
    mechanics,
    themes: families, // BGG families map to our themes
    platforms: [],
    thumbnail_url: item.thumbnail ?? null,
    image_url: item.image ?? null,
    source_url: `https://boardgamegeek.com/boardgame/${bggId}`,
    // Extended
    bayes_avg_rating: bayesAvg,
    rating_stddev: stddev,
    mfg_age_rec: optInt(item.minage?.['@_value']),
    best_players: bestPlayers,
    good_players: goodPlayers,
    num_owned: owned,
    num_want: wanting,
    num_wish: wishing,
    num_comments: numComments,
    rank_overall: getRank('boardgame'),
    rank_strategy: getRank('strategygames'),
    rank_family: getRank('familygames'),
    rank_party: getRank('partygames'),
    rank_abstract: getRank('abstracts'),
    rank_thematic: getRank('thematic'),
    rank_wargame: getRank('wargames'),
    rank_cgs: getRank('cgs'),
    rank_childrens: getRank('childrensgames'),
    designers,
    artists,
    family: familyName,
  };
}

// ─── Upsert to Supabase ─────────────────────────────────────

async function upsertGames(games: GameRow[]): Promise<number> {
  if (games.length === 0) return 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase
      .from('games')
      .upsert(games, { onConflict: 'source,source_id' });

    if (!error) return games.length;

    console.error(`${timestamp()} DB upsert error (attempt ${attempt + 1}):`, error.message);
    await sleep(2000);
  }

  return 0;
}

// ─── Main Crawler Loop ──────────────────────────────────────

async function main() {
  console.log(`${timestamp()} [BGG API Crawler] Starting: IDs ${START_ID}–${END_ID}`);
  console.log(`${timestamp()} Batch size: ${BATCH_SIZE}, Throttle: ${THROTTLE_MS}ms`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (let id = START_ID; id <= END_ID; id += BATCH_SIZE) {
    // Cooldown if too many consecutive failures
    if (consecutiveFailures >= 10) {
      console.log(`${timestamp()} 10 consecutive failures, cooling down 5 minutes...`);
      await sleep(5 * 60 * 1000);
      consecutiveFailures = 0;
    }

    const batchEnd = Math.min(id + BATCH_SIZE - 1, END_ID);
    const ids = Array.from({ length: batchEnd - id + 1 }, (_, i) => String(id + i));
    const url = `${BGG_BASE_URL}/thing?id=${ids.join(',')}&stats=1&type=boardgame`;

    // Throttle
    await sleep(THROTTLE_MS);

    const xml = await fetchBgg(url);
    if (!xml) {
      totalFailed += ids.length;
      continue;
    }

    // Parse XML
    let parsed;
    try {
      parsed = xmlParser.parse(xml);
    } catch {
      totalFailed += ids.length;
      continue;
    }

    const items = ensureArray(parsed?.items?.item);
    if (items.length === 0) {
      totalSkipped += ids.length;
      continue;
    }

    // Parse each item
    const games: GameRow[] = [];
    for (const item of items) {
      const game = parseItem(item);
      if (game) {
        games.push(game);
      } else {
        totalSkipped++;
      }
    }

    // Upsert
    const inserted = await upsertGames(games);
    totalInserted += inserted;
    totalSkipped += ids.length - items.length;

    // Progress logging
    if ((id - START_ID) % (BATCH_SIZE * (PROGRESS_INTERVAL / BATCH_SIZE)) < BATCH_SIZE) {
      console.log(
        `${timestamp()} Progress: ID ${id}–${batchEnd}/${END_ID} | ` +
        `Inserted: ${totalInserted} | Skipped: ${totalSkipped} | Failed: ${totalFailed}`
      );
    }
  }

  console.log(`\n${timestamp()} [BGG API Crawler] Done!`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log(`  Failed: ${totalFailed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
