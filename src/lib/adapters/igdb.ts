/**
 * IGDB (Internet Game Database) Adapter
 *
 * Fetches video game data from IGDB and maps it to our unified Game schema.
 * IGDB is backed by Twitch and has much richer metadata than RAWG:
 * proper genres, themes, keywords, game modes, and player perspectives.
 *
 * Auth: Twitch OAuth2 (Client Credentials flow)
 *   - IGDB_CLIENT_ID (Twitch Client ID)
 *   - IGDB_CLIENT_SECRET (Twitch Client Secret)
 *
 * API docs: https://api-docs.igdb.com/
 *
 * Key differences from RAWG:
 * - Apicalypse query language (body-based, not URL params)
 * - Ratings are 0-100 scale (we normalize to 0-10)
 * - Release dates are Unix timestamps
 * - Cover images use image_id + size template URL
 * - Much richer keyword/theme/genre taxonomy
 */

import type { Game, GameAdapter, SearchOptions } from '@/types/game';
import type { IgdbGame } from '@/types/igdb';
import { stripHtml, normalizeRating } from '@/lib/utils/parsing';

// ─── Constants ───────────────────────────────────────────────

const IGDB_BASE_URL = 'https://api.igdb.com/v4';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const IGDB_IMAGE_URL = 'https://images.igdb.com/igdb/image/upload';

// ─── Auth ────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Clears the cached OAuth token (for testing) */
export function clearTokenCache() {
  cachedToken = null;
}

/**
 * Gets a Twitch OAuth2 access token using Client Credentials flow.
 * Caches the token until it expires.
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.token;
  }

  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('[IGDB] Missing IGDB_CLIENT_ID or IGDB_CLIENT_SECRET');
  }

  const response = await fetch(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    throw new Error(`[IGDB] Token request failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

// ─── HTTP ────────────────────────────────────────────────────

/**
 * Sends an Apicalypse query to an IGDB endpoint.
 * Returns parsed JSON or null on failure.
 */
async function queryIgdb<T>(endpoint: string, body: string): Promise<T | null> {
  const token = await getAccessToken();
  const clientId = process.env.IGDB_CLIENT_ID!;

  try {
    const response = await fetch(`${IGDB_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!response.ok) {
      console.error(`[IGDB] HTTP ${response.status} for ${endpoint}`);
      return null;
    }

    return response.json() as Promise<T>;
  } catch (error) {
    console.error(`[IGDB] Fetch error for ${endpoint}:`, error);
    return null;
  }
}

// ─── Field Selection ─────────────────────────────────────────

/** Standard fields to request for game queries */
const GAME_FIELDS = [
  'name', 'summary', 'storyline', 'url',
  'first_release_date',
  'total_rating', 'total_rating_count', 'rating', 'rating_count',
  'genres.name', 'themes.name', 'game_modes.name',
  'platforms.name', 'platforms.abbreviation',
  'player_perspectives.name', 'keywords.name',
  'involved_companies.company.name', 'involved_companies.developer', 'involved_companies.publisher',
  'cover.image_id',
  'multiplayer_modes.onlinemax', 'multiplayer_modes.offlinemax', 'multiplayer_modes.offlinecoopmax',
].join(',');

// ─── Mapping ─────────────────────────────────────────────────

/** Builds an IGDB image URL from an image_id and size */
function igdbImageUrl(imageId: string, size: 'thumb' | 'cover_big' | 'screenshot_big' = 'cover_big'): string {
  return `${IGDB_IMAGE_URL}/t_${size}/${imageId}.jpg`;
}

/** Maps an IGDB game to our unified Game schema */
function mapIgdbGame(igdb: IgdbGame): Game {
  // Extract player count from multiplayer modes
  let maxPlayers = 1;
  if (igdb.multiplayer_modes?.length) {
    for (const mode of igdb.multiplayer_modes) {
      maxPlayers = Math.max(
        maxPlayers,
        mode.offlinemax ?? 0,
        mode.onlinemax ?? 0,
        mode.offlinecoopmax ?? 0,
      );
    }
  }

  // If game has multiplayer mode, assume min 1
  const hasMultiplayer = igdb.game_modes?.some(
    (m) => m.name === 'Multiplayer' || m.name === 'Co-operative' || m.name === 'Split screen',
  );
  if (hasMultiplayer && maxPlayers <= 1) maxPlayers = 4; // Reasonable default

  // Map genres → categories
  const categories = igdb.genres?.map((g) => g.name) ?? [];

  // Map themes
  const themes = igdb.themes?.map((t) => t.name) ?? [];

  // Map keywords → mechanics (closest analogue)
  const mechanics = igdb.keywords?.map((k) => k.name).slice(0, 10) ?? [];

  // Map player perspectives to mechanics too
  if (igdb.player_perspectives) {
    mechanics.push(...igdb.player_perspectives.map((p) => p.name));
  }

  // Map game modes to mechanics
  if (igdb.game_modes) {
    mechanics.push(...igdb.game_modes.map((m) => m.name));
  }

  // Platforms
  const platforms = igdb.platforms?.map((p) => p.abbreviation ?? p.name) ?? [];

  // Release year from Unix timestamp
  const yearPublished = igdb.first_release_date
    ? new Date(igdb.first_release_date * 1000).getFullYear()
    : undefined;

  // Rating: prefer total_rating (combined critic + user), normalize 0-100 → 0-10
  const rawRating = igdb.total_rating ?? igdb.rating ?? 0;
  const rating = normalizeRating(rawRating, 100, 10);
  const ratingCount = igdb.total_rating_count ?? igdb.rating_count ?? 0;

  // Description: prefer summary, fall back to storyline
  const description = stripHtml(igdb.summary ?? igdb.storyline ?? '');

  return {
    id: `igdb-${igdb.id}`,
    source: 'igdb',
    sourceId: String(igdb.id),
    name: igdb.name,
    description,
    yearPublished,
    types: ['video'],
    playerCount: { min: 1, max: maxPlayers },
    playTime: undefined, // IGDB doesn't have play time data
    complexity: undefined, // IGDB doesn't have complexity data
    rating,
    ratingCount,
    categories,
    mechanics,
    themes,
    platforms,
    thumbnailUrl: igdb.cover ? igdbImageUrl(igdb.cover.image_id, 'thumb') : undefined,
    imageUrl: igdb.cover ? igdbImageUrl(igdb.cover.image_id, 'cover_big') : undefined,
    sourceUrl: igdb.url ?? `https://www.igdb.com/games/${igdb.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  };
}

// ─── Adapter ─────────────────────────────────────────────────

export const igdbAdapter: GameAdapter = {
  source: 'igdb',

  async search(query: string, options?: SearchOptions): Promise<Game[]> {
    const limit = options?.limit ?? 20;

    const data = await queryIgdb<IgdbGame[]>(
      'games',
      `search "${query.replace(/"/g, '\\"')}";
       fields ${GAME_FIELDS};
       where version_parent = null;
       limit ${limit};`,
    );

    if (!data) return [];
    return data.map(mapIgdbGame);
  },

  async getById(id: string): Promise<Game | null> {
    const data = await queryIgdb<IgdbGame[]>(
      'games',
      `fields ${GAME_FIELDS};
       where id = ${id};
       limit 1;`,
    );

    if (!data || data.length === 0) return null;
    return mapIgdbGame(data[0]);
  },

  async getPopular(limit = 20): Promise<Game[]> {
    const data = await queryIgdb<IgdbGame[]>(
      'games',
      `fields ${GAME_FIELDS};
       where version_parent = null & total_rating_count > 50;
       sort total_rating desc;
       limit ${limit};`,
    );

    if (!data) return [];
    return data.map(mapIgdbGame);
  },
};

// ─── Crawler Helper ──────────────────────────────────────────

/**
 * Fetches a batch of games by offset for crawling.
 * Used by the IGDB crawler script.
 *
 * @param offset - Starting offset for pagination
 * @param limit - Number of games per batch (max 500 per IGDB docs)
 * @param minRatingCount - Minimum rating count filter (skip obscure games)
 */
export async function fetchIgdbBatch(
  offset: number,
  limit: number = 500,
  minRatingCount: number = 3,
): Promise<Game[]> {
  const data = await queryIgdb<IgdbGame[]>(
    'games',
    `fields ${GAME_FIELDS};
     where version_parent = null & total_rating_count >= ${minRatingCount};
     sort id asc;
     offset ${offset};
     limit ${limit};`,
  );

  if (!data) return [];
  return data.map(mapIgdbGame);
}
