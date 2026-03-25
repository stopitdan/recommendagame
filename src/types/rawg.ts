/**
 * RAWG Video Games Database API response types.
 *
 * These types represent the JSON responses from the RAWG API.
 * They are internal to the RAWG adapter — the rest of the app uses the
 * unified Game type from ./game.ts.
 *
 * Reference: https://api.rawg.io/docs/
 */

// ---------------------------------------------------------------------------
// Standard pagination envelope (all list endpoints)
// ---------------------------------------------------------------------------

export interface RawgPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ---------------------------------------------------------------------------
// GET /games (list/search) — each item in results[]
// ---------------------------------------------------------------------------

export interface RawgGameListItem {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  tba: boolean;
  background_image: string | null;
  rating: number;
  rating_top: number;
  ratings: RawgRating[];
  ratings_count: number;
  reviews_text_count: number;
  added: number;
  added_by_status: RawgAddedByStatus | null;
  metacritic: number | null;
  playtime: number;
  suggestions_count: number;
  updated: string;
  reviews_count: number;
  saturated_color: string;
  dominant_color: string;
  platforms: RawgPlatformEntry[] | null;
  parent_platforms: RawgParentPlatformEntry[] | null;
  genres: RawgGenre[];
  stores: RawgStoreEntry[] | null;
  tags: RawgTag[];
  esrb_rating: RawgEsrbRating | null;
  short_screenshots: RawgScreenshot[] | null;
}

// ---------------------------------------------------------------------------
// GET /games/{id} — full detail (extends list item)
// ---------------------------------------------------------------------------

export interface RawgGameDetail extends RawgGameListItem {
  name_original: string;
  description: string;
  description_raw: string;
  metacritic_platforms: RawgMetacriticPlatform[];
  background_image_additional: string | null;
  website: string;
  screenshots_count: number;
  movies_count: number;
  creators_count: number;
  achievements_count: number;
  parent_achievements_count: number;
  reddit_url: string;
  reddit_name: string;
  reddit_description: string;
  reddit_logo: string;
  reddit_count: number;
  twitch_count: number;
  youtube_count: number;
  alternative_names: string[];
  metacritic_url: string;
  parents_count: number;
  additions_count: number;
  game_series_count: number;
  developers: RawgDeveloper[];
  publishers: RawgPublisher[];
}

// ---------------------------------------------------------------------------
// Nested types
// ---------------------------------------------------------------------------

export interface RawgRating {
  id: number;
  title: 'exceptional' | 'recommended' | 'meh' | 'skip';
  count: number;
  percent: number;
}

export interface RawgAddedByStatus {
  yet?: number;
  owned?: number;
  beaten?: number;
  toplay?: number;
  dropped?: number;
  playing?: number;
}

export interface RawgPlatformEntry {
  platform: RawgPlatform;
  released_at: string | null;
  requirements_en: RawgRequirements | null;
  requirements_ru: RawgRequirements | null;
}

export interface RawgPlatform {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  year_end: number | null;
  year_start: number | null;
  games_count: number;
  image_background: string;
}

export interface RawgParentPlatformEntry {
  platform: {
    id: number;
    name: string;
    slug: string;
  };
}

export interface RawgRequirements {
  minimum?: string;
  recommended?: string;
}

export interface RawgGenre {
  id: number;
  name: string;
  slug: string;
  games_count: number;
  image_background: string;
}

export interface RawgStoreEntry {
  id: number;
  store: {
    id: number;
    name: string;
    slug: string;
    domain: string;
    games_count: number;
    image_background: string;
  };
}

export interface RawgTag {
  id: number;
  name: string;
  slug: string;
  language: string;
  games_count: number;
  image_background: string;
}

export interface RawgEsrbRating {
  id: number;
  name: string;
  slug: string;
}

export interface RawgScreenshot {
  id: number;
  image: string;
}

export interface RawgMetacriticPlatform {
  metascore: number;
  url: string;
  platform: {
    platform: number;
    name: string;
    slug: string;
  };
}

export interface RawgDeveloper {
  id: number;
  name: string;
  slug: string;
  games_count: number;
  image_background: string;
}

export interface RawgPublisher {
  id: number;
  name: string;
  slug: string;
  games_count: number;
  image_background: string;
}
