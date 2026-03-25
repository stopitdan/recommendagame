/**
 * Game data access layer for Supabase.
 *
 * Handles inserting games from API adapters into the database
 * and querying them back out. This is the bridge between the
 * adapter layer (which fetches from external APIs) and the
 * database layer (which stores and queries locally).
 */

import type { Game } from '@/types/game';
import type { GameInsert, GameRow } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Adapter Game → Database Row
// ---------------------------------------------------------------------------

/**
 * Converts a unified Game (from an API adapter) into a Supabase insert row.
 */
export function gameToInsert(game: Game): GameInsert {
  return {
    id: game.id,
    source: game.source,
    source_id: game.sourceId,
    name: game.name,
    description: game.description,
    year_published: game.yearPublished ?? null,
    types: game.types,
    min_players: game.playerCount?.min ?? null,
    max_players: game.playerCount?.max ?? null,
    recommended_players: game.playerCount?.recommended ?? null,
    min_play_time: game.playTime?.min ?? null,
    max_play_time: game.playTime?.max ?? null,
    avg_play_time: game.playTime?.average ?? null,
    complexity: game.complexity ?? null,
    rating: game.rating ?? null,
    rating_count: game.ratingCount ?? null,
    categories: game.categories,
    mechanics: game.mechanics,
    themes: game.themes,
    platforms: game.platforms,
    thumbnail_url: game.thumbnailUrl ?? null,
    image_url: game.imageUrl ?? null,
    source_url: game.sourceUrl ?? null,
  };
}

// ---------------------------------------------------------------------------
// Database Row → Unified Game
// ---------------------------------------------------------------------------

/**
 * Converts a Supabase game row back into our unified Game type.
 */
export function rowToGame(row: GameRow): Game {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.source_id,
    name: row.name,
    description: row.description,
    yearPublished: row.year_published ?? undefined,
    types: row.types as Game['types'],
    playerCount: (row.min_players != null || row.max_players != null)
      ? {
          min: row.min_players ?? 1,
          max: row.max_players ?? 1,
          recommended: row.recommended_players ?? undefined,
        }
      : undefined,
    playTime: (row.min_play_time != null || row.max_play_time != null)
      ? {
          min: row.min_play_time ?? 0,
          max: row.max_play_time ?? 0,
          average: row.avg_play_time ?? undefined,
        }
      : undefined,
    complexity: row.complexity ?? undefined,
    rating: row.rating ?? undefined,
    ratingCount: row.rating_count ?? undefined,
    categories: row.categories,
    mechanics: row.mechanics,
    themes: row.themes,
    platforms: row.platforms,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    imageUrl: row.image_url ?? undefined,
    sourceUrl: row.source_url ?? undefined,
  };
}
