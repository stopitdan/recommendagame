/**
 * Content-Based Filtering — Game Embeddings (Layer 2)
 *
 * Encodes game attributes into a fixed-dimension vector for similarity
 * search via pgvector. Each game gets a vector; user preferences get
 * a vector in the same space; cosine similarity finds matches.
 *
 * Vector layout (768 dimensions):
 * ┌────────────────────────────────────────────────────────────────┐
 * │ [0-149]   Category one-hot     (150 known categories)          │
 * │ [150-349] Mechanic one-hot     (200 known mechanics)           │
 * │ [350-499] Theme one-hot        (150 known themes)              │
 * │ [500-509] Type one-hot         (10 game types)                 │
 * │ [510]     Normalized complexity (0-1 from 1-5 scale)           │
 * │ [511]     Normalized rating    (0-1 from 0-10 scale)           │
 * │ [512]     Normalized min players (0-1, capped at 10)           │
 * │ [513]     Normalized max players (0-1, capped at 20)           │
 * │ [514]     Normalized avg play time (0-1, log-scaled)           │
 * │ [515]     Popularity signal    (0-1, log-scaled rating count)  │
 * │ [516-767] Reserved / padding   (zeros for future use)          │
 * └────────────────────────────────────────────────────────────────┘
 *
 * Why this structure:
 * - One-hot for categorical data gives exact matching in cosine space
 * - Normalized numerics let continuous attributes contribute proportionally
 * - Padding allows future expansion without re-embedding everything
 */

import type { Game } from '@/types/game';
import type { QuestionnaireState } from '@/types/questionnaire';
import { TIME_PRESETS } from '@/types/questionnaire';
import type { ParsedPreferences } from '@/lib/llm/types';

// ─── Constants ───────────────────────────────────────────────

export const VECTOR_DIM = 768;

// Offset boundaries for each section of the vector
const CATEGORY_OFFSET = 0;
const CATEGORY_SIZE = 150;
const MECHANIC_OFFSET = CATEGORY_OFFSET + CATEGORY_SIZE; // 150
const MECHANIC_SIZE = 200;
const THEME_OFFSET = MECHANIC_OFFSET + MECHANIC_SIZE; // 350
const THEME_SIZE = 150;
const TYPE_OFFSET = THEME_OFFSET + THEME_SIZE; // 500
const TYPE_SIZE = 10;
const NUMERIC_OFFSET = TYPE_OFFSET + TYPE_SIZE; // 510

// ─── Vocabularies ────────────────────────────────────────────

/**
 * Known categories, mechanics, themes, and types.
 * Each string gets a fixed index in the vector.
 * Uses a hash function to map arbitrary strings to indices.
 */

const KNOWN_TYPES = [
  'board', 'video', 'word', 'party', 'card',
  'dice', 'miniature', 'rpg', 'puzzle', 'trivia',
];

/**
 * Simple string hash that maps a string to a stable index within a range.
 * Uses djb2 algorithm for reasonable distribution.
 */
function hashToIndex(str: string, size: number): number {
  let hash = 5381;
  const lower = str.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    hash = ((hash << 5) + hash + lower.charCodeAt(i)) & 0x7fffffff;
  }
  return hash % size;
}

// ─── Game → Vector ───────────────────────────────────────────

/**
 * Encodes a Game into a 768-dim vector.
 */
export function gameToVector(game: Game): number[] {
  const vec = new Array(VECTOR_DIM).fill(0);

  // Categories → one-hot in [0, 150)
  for (const cat of game.categories) {
    vec[CATEGORY_OFFSET + hashToIndex(cat, CATEGORY_SIZE)] = 1;
  }

  // Mechanics → one-hot in [150, 350)
  for (const mech of game.mechanics) {
    vec[MECHANIC_OFFSET + hashToIndex(mech, MECHANIC_SIZE)] = 1;
  }

  // Themes → one-hot in [350, 500)
  for (const theme of game.themes) {
    vec[THEME_OFFSET + hashToIndex(theme, THEME_SIZE)] = 1;
  }

  // Types → one-hot in [500, 510)
  for (const type of game.types) {
    const idx = KNOWN_TYPES.indexOf(type);
    if (idx >= 0) vec[TYPE_OFFSET + idx] = 1;
  }

  // Numeric features at [510-515]
  vec[NUMERIC_OFFSET + 0] = game.complexity != null ? (game.complexity - 1) / 4 : 0.5;
  vec[NUMERIC_OFFSET + 1] = game.rating != null ? game.rating / 10 : 0.5;
  vec[NUMERIC_OFFSET + 2] = game.playerCount ? Math.min(game.playerCount.min / 10, 1) : 0.3;
  vec[NUMERIC_OFFSET + 3] = game.playerCount ? Math.min(game.playerCount.max / 20, 1) : 0.3;
  vec[NUMERIC_OFFSET + 4] = game.playTime?.average
    ? Math.min(Math.log10(game.playTime.average + 1) / 3, 1)
    : 0.3;
  vec[NUMERIC_OFFSET + 5] = game.ratingCount
    ? Math.min(Math.log10(game.ratingCount + 1) / 6, 1)
    : 0;

  return vec;
}

// ─── User Preferences → Vector ──────────────────────────────

/**
 * Encodes user preferences into a 768-dim vector in the same space
 * as game vectors. Cosine similarity between this and a game vector
 * measures preference match.
 */
export function preferencesToVector(prefs: QuestionnaireState): number[] {
  const vec = new Array(VECTOR_DIM).fill(0);

  // Map genres to categories, mechanics, and themes
  // (genres are a mix of all three in our questionnaire)
  for (const genre of prefs.genres) {
    vec[CATEGORY_OFFSET + hashToIndex(genre, CATEGORY_SIZE)] = 1;
    // Also set in mechanics/themes space for broader matching
    vec[MECHANIC_OFFSET + hashToIndex(genre, MECHANIC_SIZE)] = 0.5;
    vec[THEME_OFFSET + hashToIndex(genre, THEME_SIZE)] = 0.5;
  }

  // Map moods to implicit category/mechanic signals
  const moodMappings: Record<string, string[]> = {
    competitive: ['Auction/Bidding', 'Area Control', 'Player Elimination', 'Racing'],
    cooperative: ['Cooperative Game', 'Co-op', 'Team-Based Game'],
    chill: ['Family', 'Party', 'Casual', 'Light'],
    'brain-teaser': ['Strategy', 'Puzzle', 'Deduction', 'Logic', 'Abstract'],
    social: ['Party', 'Social Deduction', 'Bluffing', 'Negotiation', 'Voting'],
    'story-driven': ['Narrative', 'Campaign', 'RPG', 'Adventure', 'Story'],
  };

  for (const mood of prefs.moods) {
    const tags = moodMappings[mood] ?? [];
    for (const tag of tags) {
      vec[CATEGORY_OFFSET + hashToIndex(tag, CATEGORY_SIZE)] += 0.7;
      vec[MECHANIC_OFFSET + hashToIndex(tag, MECHANIC_SIZE)] += 0.7;
    }
  }

  // Game types — set all selected types
  for (const gameType of prefs.gameTypes) {
    const idx = KNOWN_TYPES.indexOf(gameType);
    if (idx >= 0) vec[TYPE_OFFSET + idx] = 1;
  }

  // Numeric features — center on user's preferred range
  const complexityMid = (prefs.complexity.min + prefs.complexity.max) / 2;
  vec[NUMERIC_OFFSET + 0] = (complexityMid - 1) / 4;

  // We don't have a rating preference per se, prefer high-rated
  vec[NUMERIC_OFFSET + 1] = 0.75;

  // Player count
  const playerMid = (prefs.playerCount.min + prefs.playerCount.max) / 2;
  vec[NUMERIC_OFFSET + 2] = Math.min(prefs.playerCount.min / 10, 1);
  vec[NUMERIC_OFFSET + 3] = Math.min(prefs.playerCount.max / 20, 1);

  // Play time from presets — use midpoint of union range
  const validPresets = prefs.timePresets.filter((tp) => TIME_PRESETS[tp]);
  if (validPresets.length > 0) {
    const unionMin = Math.min(...validPresets.map((tp) => TIME_PRESETS[tp].minMinutes));
    const unionMax = Math.max(...validPresets.map((tp) => TIME_PRESETS[tp].maxMinutes));
    const avgTime = (unionMin + unionMax) / 2;
    vec[NUMERIC_OFFSET + 4] = Math.min(Math.log10(avgTime + 1) / 3, 1);
  } else {
    vec[NUMERIC_OFFSET + 4] = 0.5; // Neutral
  }

  // Popularity — neutral by default
  vec[NUMERIC_OFFSET + 5] = 0.5;

  // Normalize the vector to unit length for cosine similarity
  return normalize(vec);
}

// ─── LLM-Enriched Preference Vector ─────────────────────────

/**
 * Builds a preference vector enriched with LLM-parsed data.
 *
 * When a user types "roguelike deck builder," the LLM extracts
 * mechanics=["Deck Building"], genres=["Roguelike"], etc.
 * This function folds those signals into the vector so pgvector
 * finds actual roguelike deck builders, not just highly-rated games.
 */
export function enrichedPreferencesToVector(
  prefs: QuestionnaireState,
  llmParsed?: ParsedPreferences | null,
): number[] {
  const vec = preferencesToVector(prefs);

  if (!llmParsed) return vec;

  // Un-normalize so we can add signals, then re-normalize at the end
  const raw = denormalize(vec);

  // LLM-extracted mechanics → mechanic slots (strong signal)
  for (const mech of llmParsed.mechanics) {
    raw[MECHANIC_OFFSET + hashToIndex(mech, MECHANIC_SIZE)] += 1.5;
  }

  // LLM-extracted genres → category + theme slots
  for (const genre of llmParsed.genres) {
    raw[CATEGORY_OFFSET + hashToIndex(genre, CATEGORY_SIZE)] += 1.2;
    raw[THEME_OFFSET + hashToIndex(genre, THEME_SIZE)] += 0.8;
  }

  // LLM-extracted keywords → spread across category/mechanic/theme
  for (const kw of llmParsed.keywords) {
    raw[CATEGORY_OFFSET + hashToIndex(kw, CATEGORY_SIZE)] += 0.6;
    raw[MECHANIC_OFFSET + hashToIndex(kw, MECHANIC_SIZE)] += 0.6;
    raw[THEME_OFFSET + hashToIndex(kw, THEME_SIZE)] += 0.6;
  }

  return normalize(raw);
}

/**
 * Reverses normalization to get back the raw (un-unit-length) vector.
 * We need this to add more signals before re-normalizing.
 */
function denormalize(vec: number[]): number[] {
  // Since we normalize to unit length, we can just scale back up.
  // But we don't know the original magnitude — the relative proportions
  // are what matter for cosine similarity, so we just clone and add to it.
  return [...vec];
}

// ─── Similarity ──────────────────────────────────────────────

/**
 * Computes cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Normalizes a vector to unit length.
 */
export function normalize(vec: number[]): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

// ─── Batch Embedding Generation ─────────────────────────────

/**
 * Generates embeddings for a batch of games.
 * Returns an array of { gameId, embedding } pairs ready for DB upsert.
 */
export function generateEmbeddings(
  games: Game[],
): Array<{ gameId: string; embedding: number[] }> {
  return games.map((game) => ({
    gameId: game.id,
    embedding: normalize(gameToVector(game)),
  }));
}
