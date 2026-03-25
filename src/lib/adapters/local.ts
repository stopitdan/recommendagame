/**
 * Local Data Adapter
 *
 * Serves games from curated local JSON datasets. Currently used for
 * digital word games that aren't covered by BGG or RAWG (Wordle,
 * Spelling Bee, Connections, etc.).
 *
 * Physical/tabletop word games (Scrabble, Codenames, Bananagrams) are
 * already covered by BGG under the "Word Game" category — no duplication
 * needed here.
 *
 * The dataset lives in src/data/word-games.json and can be extended
 * by adding more entries to the JSON file.
 */

import type { Game, GameAdapter, GameType, SearchOptions } from '@/types/game';
import wordGamesData from '@/data/word-games.json';

// ---------------------------------------------------------------------------
// Types for the raw JSON data
// ---------------------------------------------------------------------------

interface LocalGameEntry {
  id: string;
  name: string;
  description: string;
  yearPublished: number;
  types: string[];
  playerCount: { min: number; max: number };
  playTime: { min: number; max: number; average: number };
  complexity: number;
  rating: number;
  categories: string[];
  mechanics: string[];
  themes: string[];
  platforms: string[];
  thumbnailUrl: string | null;
  imageUrl: string | null;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Load and map the dataset
// ---------------------------------------------------------------------------

/** All local games, mapped to the unified Game type at import time */
const allGames: Game[] = (wordGamesData as LocalGameEntry[]).map(mapEntryToGame);

function mapEntryToGame(entry: LocalGameEntry): Game {
  return {
    id: `local-${entry.id}`,
    source: 'local',
    sourceId: entry.id,
    name: entry.name,
    description: entry.description,
    yearPublished: entry.yearPublished,
    types: entry.types as GameType[],
    playerCount: {
      min: entry.playerCount.min,
      max: entry.playerCount.max,
    },
    playTime: {
      min: entry.playTime.min,
      max: entry.playTime.max,
      average: entry.playTime.average,
    },
    complexity: entry.complexity,
    rating: entry.rating,
    ratingCount: undefined, // Local data doesn't have rating counts
    categories: entry.categories,
    mechanics: entry.mechanics,
    themes: entry.themes,
    platforms: entry.platforms,
    thumbnailUrl: entry.thumbnailUrl ?? undefined,
    imageUrl: entry.imageUrl ?? undefined,
    sourceUrl: entry.sourceUrl,
  };
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Search local games by name (case-insensitive substring match).
 */
async function search(query: string, options?: SearchOptions): Promise<Game[]> {
  const limit = options?.limit ?? 10;
  const lowerQuery = query.toLowerCase();

  let results = allGames.filter((game) =>
    game.name.toLowerCase().includes(lowerQuery) ||
    game.description.toLowerCase().includes(lowerQuery) ||
    game.categories.some((c) => c.toLowerCase().includes(lowerQuery)),
  );

  if (options?.type) {
    results = results.filter((game) => game.types.includes(options.type!));
  }

  return results.slice(0, limit);
}

/**
 * Get a local game by its ID (without the "local-" prefix).
 */
async function getById(id: string): Promise<Game | null> {
  return allGames.find((game) => game.sourceId === id) ?? null;
}

/**
 * Get popular/notable local games, sorted by rating descending.
 */
async function getPopular(limit: number = 10): Promise<Game[]> {
  return [...allGames]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Adapter Export
// ---------------------------------------------------------------------------

/**
 * The local data adapter, implementing the GameAdapter interface.
 */
export const localAdapter: GameAdapter = {
  source: 'local',
  search,
  getById,
  getPopular,
};
