/**
 * BoardGameGeek XML API2 Adapter
 *
 * Fetches board game data from BGG and maps it to our unified Game schema.
 * Handles XML parsing, rate limiting, 202 retries, and field normalization.
 *
 * API docs: https://boardgamegeek.com/wiki/page/BGG_XML_API2
 *
 * Key constraints:
 * - All responses are XML (parsed via fast-xml-parser)
 * - Rate limit: ~1 request per 5 seconds
 * - /thing endpoint may return 202 ("not ready") — must retry with delay
 * - Search returns sparse data (ID + name only) — need follow-up /thing call
 */

import { XMLParser } from 'fast-xml-parser';
import type { Game, GameAdapter, SearchOptions } from '@/types/game';
import type {
  BggSearchResponse,
  BggSearchItem,
  BggThingResponse,
  BggThingItem,
  BggHotResponse,
  BggHotItem,
  BggName,
  BggPoll,
  BggPollResults,
  BggPollResult,
  BggLink,
} from '@/types/bgg';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BGG_BASE_URL = 'https://boardgamegeek.com/xmlapi2';
const USER_AGENT = 'RecommendAGame/1.0 (https://recommendagame.com)';

/** Minimum ms between API requests to respect BGG rate limits */
const THROTTLE_MS = 5000;

/** Max retries when BGG returns 202 ("queued, try again") */
const MAX_RETRIES = 3;

/** Delay between 202 retries in ms */
const RETRY_DELAY_MS = 2000;

/** Max IDs per /thing request to avoid timeouts */
const BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// XML Parser Configuration
// ---------------------------------------------------------------------------

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => {
    // These fields can be single items or arrays depending on result count.
    // Force them to always be arrays for consistent handling.
    return ['item', 'name', 'link', 'poll', 'results', 'result'].includes(name);
  },
});

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

let lastRequestTime = 0;

/**
 * Waits if necessary to respect BGG's rate limit before making a request.
 */
async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < THROTTLE_MS) {
    await sleep(THROTTLE_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// HTTP Fetching (with 202 retry logic)
// ---------------------------------------------------------------------------

/**
 * Fetches a URL from BGG with rate limiting, 202 retry handling, and
 * a proper User-Agent header.
 *
 * Returns the raw XML text, or null if the request ultimately fails.
 */
async function fetchBgg(url: string): Promise<string | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await throttle();

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (response.status === 202) {
      // BGG is still preparing the data — wait and retry
      console.log(`[BGG] 202 received, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    if (!response.ok) {
      console.error(`[BGG] HTTP ${response.status} for ${url}`);
      return null;
    }

    return response.text();
  }

  console.error(`[BGG] Gave up after ${MAX_RETRIES} retries for ${url}`);
  return null;
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Search BGG for board games by name.
 *
 * This is a two-step process:
 * 1. /search returns matching IDs and names (sparse data)
 * 2. /thing fetches full details for those IDs
 */
async function search(query: string, options?: SearchOptions): Promise<Game[]> {
  const limit = options?.limit ?? 10;
  const searchUrl = `${BGG_BASE_URL}/search?query=${encodeURIComponent(query)}&type=boardgame`;

  const xml = await fetchBgg(searchUrl);
  if (!xml) return [];

  const parsed = xmlParser.parse(xml) as BggSearchResponse;
  const items = parsed?.items?.item;
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  // Take the top N IDs from search results
  const topItems = items.slice(0, limit);
  const ids = topItems.map((item) => item['@_id']);

  // Fetch full details for these IDs
  return fetchThingsByIds(ids);
}

/**
 * Fetch a single game by its BGG ID.
 */
async function getById(id: string): Promise<Game | null> {
  const games = await fetchThingsByIds([id]);
  return games[0] ?? null;
}

/**
 * Fetch BGG's current "hot" board games list (up to 50 items).
 * Note: The hot list only returns basic info — we follow up with /thing
 * for full details.
 */
async function getPopular(limit: number = 10): Promise<Game[]> {
  const url = `${BGG_BASE_URL}/hot?type=boardgame`;

  const xml = await fetchBgg(url);
  if (!xml) return [];

  const parsed = xmlParser.parse(xml) as BggHotResponse;
  const items = parsed?.items?.item;
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  const topItems = items.slice(0, limit);
  const ids = topItems.map((item) => item['@_id']);

  return fetchThingsByIds(ids);
}

// ---------------------------------------------------------------------------
// /thing Fetching (batched)
// ---------------------------------------------------------------------------

/**
 * Fetch full game details from /thing for a list of BGG IDs.
 * Batches requests in groups to avoid timeouts.
 */
async function fetchThingsByIds(ids: string[]): Promise<Game[]> {
  const games: Game[] = [];

  // Process IDs in batches
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const batchGames = await fetchThingBatch(batch);
    games.push(...batchGames);
  }

  return games;
}

/**
 * Fetch a single batch of game details from /thing.
 */
async function fetchThingBatch(ids: string[]): Promise<Game[]> {
  const url = `${BGG_BASE_URL}/thing?id=${ids.join(',')}&stats=1`;

  const xml = await fetchBgg(url);
  if (!xml) return [];

  const parsed = xmlParser.parse(xml) as BggThingResponse;
  const items = parsed?.items?.item;
  if (!items || !Array.isArray(items)) return [];

  return items
    .filter((item) => item['@_type'] === 'boardgame')
    .map(mapThingToGame);
}

// ---------------------------------------------------------------------------
// Mapping: BGG Thing → Unified Game
// ---------------------------------------------------------------------------

/**
 * Maps a BGG /thing item to our unified Game schema.
 */
function mapThingToGame(item: BggThingItem): Game {
  const names = ensureArray(item.name);
  const links = ensureArray(item.link);
  const polls = ensureArray(item.poll);

  const primaryName = names.find((n) => n['@_type'] === 'primary');
  const suggestedPlayersPoll = polls.find((p) => p['@_name'] === 'suggested_numplayers');

  return {
    id: `bgg-${item['@_id']}`,
    source: 'bgg',
    sourceId: item['@_id'],
    name: primaryName?.['@_value'] ?? names[0]?.['@_value'] ?? 'Unknown',
    description: stripHtml(item.description ?? ''),
    yearPublished: parseOptionalInt(item.yearpublished?.['@_value']),
    types: ['board'],
    playerCount: {
      min: parseOptionalInt(item.minplayers?.['@_value']) ?? 1,
      max: parseOptionalInt(item.maxplayers?.['@_value']) ?? 1,
      recommended: suggestedPlayersPoll
        ? parseRecommendedPlayers(suggestedPlayersPoll)
        : undefined,
    },
    playTime: {
      min: parseOptionalInt(item.minplaytime?.['@_value']) ?? 0,
      max: parseOptionalInt(item.maxplaytime?.['@_value']) ?? 0,
      average: parseOptionalInt(item.playingtime?.['@_value']),
    },
    complexity: parseOptionalFloat(item.statistics?.ratings?.averageweight?.['@_value']),
    rating: parseOptionalFloat(item.statistics?.ratings?.average?.['@_value']),
    ratingCount: parseOptionalInt(item.statistics?.ratings?.usersrated?.['@_value']),
    categories: extractLinks(links, 'boardgamecategory'),
    mechanics: extractLinks(links, 'boardgamemechanic'),
    themes: extractLinks(links, 'boardgamefamily'),
    platforms: [], // Not applicable for board games
    thumbnailUrl: item.thumbnail ?? undefined,
    imageUrl: item.image ?? undefined,
    sourceUrl: `https://boardgamegeek.com/boardgame/${item['@_id']}`,
  };
}

// ---------------------------------------------------------------------------
// Field Parsing Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts link values of a specific type (e.g. "boardgamecategory").
 */
function extractLinks(links: BggLink[], type: string): string[] {
  return links
    .filter((link) => link['@_type'] === type)
    .map((link) => link['@_value']);
}

/**
 * Parses the "suggested_numplayers" poll to find the recommended player count.
 *
 * BGG polls include voting results for each player count with "Best",
 * "Recommended", and "Not Recommended" options. We find the player count
 * with the most "Best" votes.
 */
function parseRecommendedPlayers(poll: BggPoll): number | undefined {
  const allResults = ensureArray(poll.results);

  let bestCount: number | undefined;
  let bestVotes = 0;

  for (const results of allResults) {
    const numPlayers = parseInt(results['@_numplayers'] ?? '', 10);
    if (isNaN(numPlayers)) continue;

    const votes = ensureArray(results.result);
    const bestOption = votes.find((v) => v['@_value'] === 'Best');
    const voteCount = parseInt(bestOption?.['@_numvotes'] ?? '0', 10);

    if (voteCount > bestVotes) {
      bestVotes = voteCount;
      bestCount = numPlayers;
    }
  }

  return bestCount;
}

/**
 * Strips HTML tags and decodes common HTML entities from BGG descriptions.
 */
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

/**
 * Ensures a value is always an array. BGG XML can return a single item
 * or an array depending on result count — this normalizes the inconsistency.
 */
function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

function parseOptionalFloat(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

// ---------------------------------------------------------------------------
// Adapter Export
// ---------------------------------------------------------------------------

/**
 * The BGG adapter, implementing the GameAdapter interface.
 */
export const bggAdapter: GameAdapter = {
  source: 'bgg',
  search,
  getById,
  getPopular,
};
