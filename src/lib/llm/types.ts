/**
 * Types for LLM-powered free text parsing.
 *
 * When a user types "I want a roguelike deck builder for 2 players,"
 * the LLM extracts this into structured preferences that pre-fill
 * the questionnaire and enhance recommendation scoring.
 */

export interface ParsedPreferences {
  /** Game types: "board", "video", "word", "party", "card" */
  gameTypes: string[];

  /** Genre/category preferences: "Strategy", "RPG", "Horror", etc. */
  genres: string[];

  /** Game mechanics: "Deck Building", "Worker Placement", etc. */
  mechanics: string[];

  /** Mood/vibe: "competitive", "cooperative", "chill", etc. */
  moods: string[];

  /** Complexity range (1-5 scale), or null if not mentioned */
  complexity: { min: number; max: number } | null;

  /** Player count range, or null if not mentioned */
  playerCount: { min: number; max: number } | null;

  /** Time presets: "quick", "short", "medium", "long", "epic" */
  timePresets: string[];

  /** Specific game names the user mentioned or compared to */
  similarTo: string[];

  /** Additional keywords that don't fit other categories */
  keywords: string[];
}

/** Empty parsed preferences (used as default/fallback) */
export const EMPTY_PARSED: ParsedPreferences = {
  gameTypes: [],
  genres: [],
  mechanics: [],
  moods: [],
  complexity: null,
  playerCount: null,
  timePresets: [],
  similarTo: [],
  keywords: [],
};
