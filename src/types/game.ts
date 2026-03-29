/** The external data source a game was fetched from */
export type GameSource = 'bgg' | 'rawg' | 'igdb' | 'local';

/** Broad category of game */
export type GameType = 'board' | 'video' | 'word' | 'party' | 'card';

/** Player count range */
export interface PlayerCount {
  min: number;
  max: number;
  /** Optimal player count, if known (e.g. from BGG polls) */
  recommended?: number;
}

/** Play time in minutes */
export interface PlayTime {
  min: number;
  max: number;
  average?: number;
}

/**
 * Unified game representation across all data sources.
 * Every API adapter maps its response into this shape.
 */
export interface Game {
  /** Globally unique ID, prefixed with source (e.g. "bgg-13", "rawg-3498") */
  id: string;

  /** Which API/dataset this game came from */
  source: GameSource;

  /** The game's native ID in its source system */
  sourceId: string;

  /** Primary name */
  name: string;

  /** Full text description (HTML stripped) */
  description: string;

  /** Year the game was published/released */
  yearPublished?: number;

  /** Broad game type */
  types: GameType[];

  /** Player count range */
  playerCount?: PlayerCount;

  /** Play time in minutes */
  playTime?: PlayTime;

  /**
   * Complexity on a 1-5 scale.
   * 1 = very simple (e.g. Candy Land), 5 = very complex (e.g. Twilight Imperium).
   * Normalized from source-specific scales.
   */
  complexity?: number;

  /** Normalized rating on a 0-10 scale */
  rating?: number;

  /** Number of ratings/votes from the source */
  ratingCount?: number;

  /** Genre/category labels (e.g. "Strategy", "RPG", "Puzzle") */
  categories: string[];

  /** Game mechanics (e.g. "Deck Building", "Dice Rolling", "Open World") */
  mechanics: string[];

  /** Thematic tags (e.g. "Fantasy", "Sci-Fi", "Medieval") */
  themes: string[];

  /** Platforms — primarily for video games (e.g. "PC", "PlayStation 5") */
  platforms: string[];

  /** Thumbnail image URL */
  thumbnailUrl?: string;

  /** Full-size image URL */
  imageUrl?: string;

  /** Link to the game's page on the source site */
  sourceUrl?: string;

  /** BGG overall rank (lower = better, e.g. #1 = best game on BGG) */
  rankOverall?: number;

  /** Number of people who own this game (BGG) */
  numOwned?: number;

  /** BGG's Bayesian-adjusted rating (dampened toward global mean) */
  bayesAvgRating?: number;
}

/**
 * Common interface that every data source adapter must implement.
 */
export interface GameAdapter {
  /** The source this adapter provides data for */
  source: GameSource;

  /** Search for games by name */
  search(query: string, options?: SearchOptions): Promise<Game[]>;

  /** Fetch a single game by its source-specific ID */
  getById(id: string): Promise<Game | null>;

  /** Fetch currently popular/trending games, if supported */
  getPopular?(limit?: number): Promise<Game[]>;
}

export interface SearchOptions {
  /** Maximum number of results to return */
  limit?: number;

  /** Filter by game type */
  type?: GameType;
}
