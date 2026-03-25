/**
 * Types for the questionnaire flow.
 *
 * These represent the user's answers at each step. The completed
 * QuestionnaireState gets converted into search/recommendation params.
 */

import type { GameType } from './game';

export interface QuestionnaireState {
  /** Step 1: What types of game? Empty = any type */
  gameTypes: GameType[];

  /** Step 2: Player count range */
  playerCount: PlayerCountRange;

  /** Step 3: How much time available. Multiple = flexible */
  timePresets: TimePreset[];

  /** Step 4: Complexity preference range (1-5) */
  complexity: ComplexityRange;

  /** Step 5: Selected genres/categories */
  genres: string[];

  /** Step 6: Selected moods/vibes */
  moods: string[];

  /** Step 7: Free text input */
  freeText: string;
}

export interface PlayerCountRange {
  min: number;
  max: number;
}

export interface ComplexityRange {
  min: number;
  max: number;
}

export type TimePreset = 'quick' | 'short' | 'medium' | 'long' | 'epic';

export const TIME_PRESETS: Record<TimePreset, { label: string; description: string; minMinutes: number; maxMinutes: number }> = {
  quick: { label: 'Quick', description: 'Under 15 min', minMinutes: 0, maxMinutes: 15 },
  short: { label: 'Short', description: '15–30 min', minMinutes: 15, maxMinutes: 30 },
  medium: { label: 'Medium', description: '30–60 min', minMinutes: 30, maxMinutes: 60 },
  long: { label: 'Long', description: '1–2 hours', minMinutes: 60, maxMinutes: 120 },
  epic: { label: 'Epic', description: '2+ hours', minMinutes: 120, maxMinutes: 999 },
};

export const GENRE_OPTIONS = [
  'Strategy', 'RPG', 'Puzzle', 'Action', 'Adventure', 'Horror',
  'Sci-Fi', 'Fantasy', 'Trivia', 'Word Game', 'Deck Building',
  'Simulation', 'Sports', 'Racing', 'Fighting', 'Platformer',
  'Shooter', 'Survival', 'Mystery', 'Family',
] as const;

export const MOOD_OPTIONS = [
  { id: 'competitive', label: 'Competitive', description: 'I want to crush my friends' },
  { id: 'cooperative', label: 'Cooperative', description: 'Let\'s work together' },
  { id: 'chill', label: 'Chill', description: 'Something relaxing' },
  { id: 'brain-teaser', label: 'Brain Teaser', description: 'Make me think hard' },
  { id: 'social', label: 'Social', description: 'Lots of laughing and talking' },
  { id: 'story-driven', label: 'Story-Driven', description: 'Immerse me in a world' },
] as const;

export const INITIAL_STATE: QuestionnaireState = {
  gameTypes: [],
  playerCount: { min: 1, max: 8 },
  timePresets: [],
  complexity: { min: 1, max: 5 },
  genres: [],
  moods: [],
  freeText: '',
};
