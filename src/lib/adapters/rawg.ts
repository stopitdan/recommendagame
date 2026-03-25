/**
 * RAWG Video Games Database Adapter
 *
 * Fetches video game data from RAWG and maps it to our unified Game schema.
 * Much simpler than BGG — JSON responses, no XML parsing, no 202 retries.
 *
 * API docs: https://api.rawg.io/docs/
 *
 * Key constraints:
 * - All requests require API key as query param (?key=...)
 * - Rate limits not explicitly documented — be reasonable
 * - Search returns rich data in list endpoint (no follow-up call needed)
 * - Detail endpoint adds description, developers, publishers
 * - Rating is 0-5 scale (we normalize to 0-10)
 * - Playtime is in hours (we convert to minutes)
 */

import type { Game, GameAdapter, SearchOptions } from '@/types/game';
import type {
  RawgPaginatedResponse,
  RawgGameListItem,
  RawgGameDetail,
  RawgTag,
} from '@/types/rawg';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RAWG_BASE_URL = 'https://api.rawg.io/api';

function getApiKey(): string {
  const key = process.env.RAWG_API_KEY;
  if (!key) {
    throw new Error('[RAWG] Missing RAWG_API_KEY environment variable');
  }
  return key;
}

// ---------------------------------------------------------------------------
// HTTP Fetching
// ---------------------------------------------------------------------------

/**
 * Fetches a URL from RAWG with the API key appended.
 * Returns parsed JSON, or null on failure.
 */
async function fetchRawg<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(`${RAWG_BASE_URL}${path}`);
  url.searchParams.set('key', getApiKey());

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error(`[RAWG] HTTP ${response.status} for ${path}`);
      return null;
    }

    return response.json() as Promise<T>;
  } catch (error) {
    console.error(`[RAWG] Fetch error for ${path}:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Search RAWG for video games by name.
 *
 * Unlike BGG, RAWG returns rich data in the list endpoint, so we
 * don't need a follow-up detail call for basic info. We only call
 * the detail endpoint when we need the full description.
 */
async function search(query: string, options?: SearchOptions): Promise<Game[]> {
  const limit = options?.limit ?? 10;

  const data = await fetchRawg<RawgPaginatedResponse<RawgGameListItem>>('/games', {
    search: query,
    page_size: String(limit),
    search_precise: 'true',
  });

  if (!data?.results) return [];

  return data.results.map(mapListItemToGame);
}

/**
 * Fetch a single game by its RAWG ID.
 * Uses the detail endpoint for full description and metadata.
 */
async function getById(id: string): Promise<Game | null> {
  const data = await fetchRawg<RawgGameDetail>(`/games/${id}`);
  if (!data) return null;

  return mapDetailToGame(data);
}

/**
 * Fetch currently popular/top-rated video games.
 * Ordered by rating descending, filtered to highly-rated games.
 */
async function getPopular(limit: number = 10): Promise<Game[]> {
  const data = await fetchRawg<RawgPaginatedResponse<RawgGameListItem>>('/games', {
    ordering: '-rating',
    page_size: String(limit),
    metacritic: '80,100',
  });

  if (!data?.results) return [];

  return data.results.map(mapListItemToGame);
}

// ---------------------------------------------------------------------------
// Mapping: RAWG List Item → Unified Game
// ---------------------------------------------------------------------------

/**
 * Maps a RAWG list item (from /games search) to our unified Game schema.
 * List items don't include full descriptions — description will be empty.
 */
function mapListItemToGame(item: RawgGameListItem): Game {
  return {
    id: `rawg-${item.id}`,
    source: 'rawg',
    sourceId: String(item.id),
    name: item.name,
    description: '', // Not available in list endpoint
    yearPublished: item.released ? parseInt(item.released.slice(0, 4), 10) : undefined,
    types: ['video'],
    playerCount: undefined, // RAWG doesn't provide player count data
    playTime: item.playtime > 0
      ? {
          min: 0,
          max: item.playtime * 60, // RAWG reports in hours, we use minutes
          average: item.playtime * 60,
        }
      : undefined,
    complexity: undefined, // RAWG doesn't have a complexity metric
    rating: normalizeRating(item.rating),
    ratingCount: item.ratings_count,
    categories: item.genres.map((g) => g.name),
    mechanics: [], // RAWG doesn't have a "mechanics" concept
    themes: extractThemes(item.tags),
    platforms: extractPlatforms(item),
    thumbnailUrl: item.background_image ?? undefined,
    imageUrl: item.background_image ?? undefined,
    sourceUrl: `https://rawg.io/games/${item.slug}`,
  };
}

// ---------------------------------------------------------------------------
// Mapping: RAWG Detail → Unified Game
// ---------------------------------------------------------------------------

/**
 * Maps a RAWG detail item (from /games/{id}) to our unified Game schema.
 * Includes full description and additional metadata.
 */
function mapDetailToGame(item: RawgGameDetail): Game {
  const game = mapListItemToGame(item);

  return {
    ...game,
    description: item.description_raw || stripHtml(item.description),
  };
}

// ---------------------------------------------------------------------------
// Field Parsing Helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes RAWG's 0-5 rating to our 0-10 scale.
 */
function normalizeRating(rating: number): number | undefined {
  if (rating <= 0) return undefined;
  return Math.round(rating * 2 * 10) / 10; // e.g. 4.47 → 8.9
}

/**
 * Extracts platform names from RAWG's nested platform structure.
 * Uses parent platforms for cleaner grouping (e.g. "PC" instead of
 * "PC", "Windows", "Linux" separately).
 */
function extractPlatforms(item: RawgGameListItem): string[] {
  if (item.parent_platforms) {
    return item.parent_platforms.map((p) => p.platform.name);
  }
  if (item.platforms) {
    return item.platforms.map((p) => p.platform.name);
  }
  return [];
}

/**
 * Extracts thematic tags from RAWG tags.
 *
 * RAWG tags are a mix of mechanics-like tags ("Multiplayer", "Co-op")
 * and theme tags ("Sci-fi", "Fantasy", "Medieval"). We filter to
 * English-language tags and take a reasonable subset.
 */
function extractThemes(tags: RawgTag[]): string[] {
  return tags
    .filter((t) => t.language === 'eng')
    .map((t) => t.name)
    .slice(0, 20); // Cap at 20 to avoid noise
}

/**
 * Strips HTML tags from RAWG descriptions.
 * Used as fallback when description_raw is not available.
 */
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
// Adapter Export
// ---------------------------------------------------------------------------

/**
 * The RAWG adapter, implementing the GameAdapter interface.
 */
export const rawgAdapter: GameAdapter = {
  source: 'rawg',
  search,
  getById,
  getPopular,
};
