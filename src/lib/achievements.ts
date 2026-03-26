/**
 * Achievement System
 *
 * Defines all achievements and provides functions to check
 * and unlock them. Achievements are stored in Supabase and
 * cached client-side.
 */

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  /** How rare this achievement is (affects display) */
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_roll',
    name: 'First Roll',
    emoji: '🎲',
    description: 'Rolled the d20 for the first time',
    rarity: 'common',
  },
  {
    id: 'natural_20',
    name: 'Natural 20 Club',
    emoji: '🏆',
    description: 'Rolled a Natural 20 — Critical Success!',
    rarity: 'rare',
  },
  {
    id: 'natural_1',
    name: 'Critical Failure',
    emoji: '💀',
    description: 'Rolled a Natural 1 — the dice gods have forsaken you',
    rarity: 'uncommon',
  },
  {
    id: 'first_search',
    name: 'Game Seeker',
    emoji: '🔍',
    description: 'Used Find a Game for the first time',
    rarity: 'common',
  },
  {
    id: 'picky_player',
    name: 'Picky Player',
    emoji: '🎯',
    description: 'Used 5 or more filters in a single search',
    rarity: 'uncommon',
  },
  {
    id: 'first_favorite',
    name: 'Bookworm',
    emoji: '❤️',
    description: 'Added your first game to favorites',
    rarity: 'common',
  },
  {
    id: 'five_favorites',
    name: 'Collector',
    emoji: '📚',
    description: 'Added 5 games to favorites',
    rarity: 'uncommon',
  },
  {
    id: 'first_review',
    name: 'Critic',
    emoji: '✍️',
    description: 'Wrote your first game review',
    rarity: 'common',
  },
  {
    id: 'ten_reviews',
    name: 'Seasoned Critic',
    emoji: '🎭',
    description: 'Wrote 10 game reviews',
    rarity: 'rare',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    emoji: '🦉',
    description: 'Used the app between midnight and 4am',
    rarity: 'uncommon',
  },
  {
    id: 'dark_side',
    name: 'Dark Side',
    emoji: '🌙',
    description: 'Activated dark mode',
    rarity: 'common',
  },
  {
    id: 'explorer',
    name: 'Explorer',
    emoji: '🗺️',
    description: 'Browsed through 50+ games',
    rarity: 'uncommon',
  },
  {
    id: 'shared_invite',
    name: 'Party Planner',
    emoji: '📤',
    description: 'Shared a game night invite',
    rarity: 'uncommon',
  },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

const RARITY_COLORS: Record<string, string> = {
  common: '#A0A0C0',
  uncommon: '#22C55E',
  rare: '#5B4FDB',
  legendary: '#FFB020',
};

export function getRarityColor(rarity: string): string {
  return RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
}
