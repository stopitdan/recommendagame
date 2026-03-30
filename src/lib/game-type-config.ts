/**
 * Centralized game type visual config.
 *
 * Maps each GameType to its signature accent color, icon component,
 * and display label. Used by GameCard, filter chips, detail pages,
 * and the questionnaire to maintain a consistent visual language:
 *
 *   Board  = Indigo (primary)
 *   Video  = Coral (secondary)
 *   Word   = Cyan (accent)
 *   Party  = Gold (rating)
 *   Card   = Indigo (same as board)
 */

import type { GameType } from '@/types/game';

export interface GameTypeVisual {
  color: string;
  /** Light background tint (3-6% opacity) for cards */
  tintLight: string;
  tintDark: string;
  label: string;
}

const CONFIG: Record<GameType, GameTypeVisual> = {
  board: {
    color: '#5B4FDB',
    tintLight: 'rgba(91, 79, 219, 0.03)',
    tintDark: 'rgba(91, 79, 219, 0.06)',
    label: 'Board Game',
  },
  video: {
    color: '#FF6D3F',
    tintLight: 'rgba(255, 109, 63, 0.03)',
    tintDark: 'rgba(255, 109, 63, 0.06)',
    label: 'Video Game',
  },
  word: {
    color: '#0EC6C6',
    tintLight: 'rgba(14, 198, 198, 0.03)',
    tintDark: 'rgba(14, 198, 198, 0.06)',
    label: 'Word Game',
  },
  party: {
    color: '#FFB020',
    tintLight: 'rgba(255, 176, 32, 0.03)',
    tintDark: 'rgba(255, 176, 32, 0.06)',
    label: 'Party Game',
  },
  card: {
    color: '#5B4FDB',
    tintLight: 'rgba(91, 79, 219, 0.03)',
    tintDark: 'rgba(91, 79, 219, 0.06)',
    label: 'Card Game',
  },
};

export function getGameTypeConfig(type: GameType): GameTypeVisual {
  return CONFIG[type] ?? CONFIG.board;
}

/** Get config for the primary type of a game (first in the types array) */
export function getPrimaryTypeConfig(types: GameType[]): GameTypeVisual {
  return getGameTypeConfig(types[0] ?? 'board');
}
