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

  /** Specific game names the user mentioned or compared to (wants alternatives) */
  similarTo: string[];

  /** Franchise/IP names the user wants games FROM (not alternatives) */
  franchiseSearch: string[];

  /** Additional keywords that don't fit other categories */
  keywords: string[];

  /** Genres/categories the user explicitly does NOT want */
  excludedGenres: string[];

  /** Mechanics the user explicitly does NOT want */
  excludedMechanics: string[];

  /** Exact max time in minutes if user specified (e.g., "under 30 minutes" = 30) */
  maxMinutes: number | null;

  /** How strict the time limit is: "hard" for "under/less than/no more than", "soft" for "about/around" */
  timeStrictness: 'hard' | 'soft' | null;

  /** Designer/author names the user mentioned */
  designers: string[];

  /**
   * Intent modifiers -- preserve the intensity/priority of preferences.
   * "Must have deck building" vs "would be nice if cooperative" carry
   * very different weights in scoring.
   */
  intentModifiers?: {
    /** Strong requirements: "must have", "need", "has to be" */
    mustHave: string[];
    /** Nice-to-haves: "would be cool if", "ideally", "bonus if" */
    niceToHave: string[];
    /** Things to avoid: "not too random", "avoid", "less" */
    avoid: string[];
    /** Things to emphasize: "really strategic", "very thematic", "extremely" */
    emphasize: string[];
  };

  /**
   * Comparison structure -- when user says "like X but different in Y",
   * preserve the relationship so scoring can keep X's good attributes
   * while penalizing the things user wants changed.
   */
  comparisonBase?: {
    /** The reference game: "like Catan" -> "Catan" */
    game: string;
    /** Attributes to keep: "the trading part" -> ["trading", "resource management"] */
    keepAttributes: string[];
    /** Attributes to change: "less random" -> ["less dice rolling"] */
    changeAttributes: string[];
  };
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
  franchiseSearch: [],
  keywords: [],
  excludedGenres: [],
  excludedMechanics: [],
  maxMinutes: null,
  timeStrictness: null,
  designers: [],
};
