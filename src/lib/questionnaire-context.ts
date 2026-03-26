/**
 * Smart filtering for questionnaire steps based on previous answers.
 *
 * Hides options that don't make sense given what the user already selected.
 * For example: "Competitive" mood is hidden for 1-player games,
 * "Platformer" genre is hidden for board games.
 */

import type { QuestionnaireState } from '@/types/questionnaire';
import { MOOD_OPTIONS, GENRE_OPTIONS } from '@/types/questionnaire';

// ─── Mood Filtering ──────────────────────────────────────────

/** Moods that require multiple players */
const MULTIPLAYER_MOODS = new Set(['competitive', 'social']);

/** Moods that don't fit certain game types */
const MOOD_TYPE_EXCLUSIONS: Record<string, Set<string>> = {
  'word': new Set(['story-driven']),
  'party': new Set(['brain-teaser', 'story-driven']),
};

export function getFilteredMoods(state: QuestionnaireState) {
  const isSolo = state.playerCount.max === 1;
  const selectedTypes = state.gameTypes;

  return MOOD_OPTIONS.filter((mood) => {
    // Hide multiplayer moods for solo games
    if (isSolo && MULTIPLAYER_MOODS.has(mood.id)) return false;

    // Hide moods that don't fit selected game types
    for (const type of selectedTypes) {
      if (MOOD_TYPE_EXCLUSIONS[type]?.has(mood.id)) return false;
    }

    return true;
  });
}

/** Get adapted descriptions based on context */
export function getMoodDescription(moodId: string, state: QuestionnaireState): string {
  const isSolo = state.playerCount.max === 1;
  const isTwoPlayer = state.playerCount.max === 2 && state.playerCount.min <= 2;

  const overrides: Record<string, Record<string, string>> = {
    cooperative: {
      solo: 'Work with the game itself',
      duo: 'Team up with your partner',
    },
  };

  if (isSolo && overrides[moodId]?.solo) return overrides[moodId].solo;
  if (isTwoPlayer && overrides[moodId]?.duo) return overrides[moodId].duo;

  return MOOD_OPTIONS.find((m) => m.id === moodId)?.description ?? '';
}

// ─── Genre Filtering ─────────────────────────────────────────

/** Video game-only genres (hide for board/word/party) */
const VIDEO_GAME_GENRES = new Set([
  'Shooter', 'Platformer', 'Metroidvania', 'Open World',
  'Sandbox', 'Racing', 'Fighting',
]);

/** Board game-only genres (hide for video games) */
const BOARD_GAME_GENRES = new Set([
  'Worker Placement', 'Social Deduction', 'Legacy', 'Campaign',
]);

/** Genres that need multiple players */
const MULTIPLAYER_GENRES = new Set([
  'Social Deduction', 'Party',
]);

export function getFilteredGenres(state: QuestionnaireState): readonly string[] {
  const selectedTypes = state.gameTypes;
  const isSolo = state.playerCount.max === 1;
  const hasOnlyBoard = selectedTypes.length > 0 && selectedTypes.every((t) => t === 'board');
  const hasOnlyVideo = selectedTypes.length > 0 && selectedTypes.every((t) => t === 'video');

  return GENRE_OPTIONS.filter((genre) => {
    // Hide video-game genres if user only selected board games
    if (hasOnlyBoard && VIDEO_GAME_GENRES.has(genre)) return false;

    // Hide board-game genres if user only selected video games
    if (hasOnlyVideo && BOARD_GAME_GENRES.has(genre)) return false;

    // Hide multiplayer genres for solo
    if (isSolo && MULTIPLAYER_GENRES.has(genre)) return false;

    return true;
  });
}
