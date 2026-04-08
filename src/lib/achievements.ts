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

  // ── Dice Rolling ──
  {
    id: 'lucky_streak',
    name: 'Lucky Streak',
    emoji: '🔥',
    description: 'Rolled 15+ three times in a row',
    rarity: 'rare',
  },
  {
    id: 'snake_eyes',
    name: 'Snake Eyes',
    emoji: '🐍',
    description: 'Rolled a 1 twice in a row',
    rarity: 'uncommon',
  },
  {
    id: 'double_down',
    name: 'Double Down',
    emoji: '🎰',
    description: 'Rolled the same number twice in a row',
    rarity: 'uncommon',
  },
  {
    id: 'century_club',
    name: 'Century Club',
    emoji: '💯',
    description: 'Rolled the d20 100 times total',
    rarity: 'rare',
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    emoji: '⚡',
    description: 'Rolled 5 times within 60 seconds',
    rarity: 'uncommon',
  },

  // ── Multi-Dice ──
  {
    id: 'dice_collector',
    name: 'Dice Collector',
    emoji: '🎰',
    description: 'Rolled 4 different types of dice',
    rarity: 'uncommon',
  },
  {
    id: 'max_roll',
    name: 'Max Roll',
    emoji: '📈',
    description: 'Rolled the maximum value on any non-D20 die',
    rarity: 'uncommon',
  },
  {
    id: 'percentile_100',
    name: 'One in a Hundred',
    emoji: '💯',
    description: 'Rolled 00 on the percentile die',
    rarity: 'rare',
  },
  {
    id: 'full_set_roll',
    name: 'Full Set',
    emoji: '🧰',
    description: 'Rolled all 7 dice types in one session',
    rarity: 'rare',
  },

  // ── Discovery & Search ──
  {
    id: 'genre_hopper',
    name: 'Genre Hopper',
    emoji: '🦘',
    description: 'Searched for 5 different game types',
    rarity: 'uncommon',
  },
  {
    id: 'time_traveler',
    name: 'Time Traveler',
    emoji: '⏰',
    description: 'Found a game published before 1980',
    rarity: 'rare',
  },
  {
    id: 'retro_gamer',
    name: 'Retro Gamer',
    emoji: '👾',
    description: 'Browsed a game from before 1990',
    rarity: 'uncommon',
  },
  {
    id: 'cutting_edge',
    name: 'Cutting Edge',
    emoji: '🔪',
    description: 'Found a game published this year',
    rarity: 'uncommon',
  },
  {
    id: 'deep_diver',
    name: 'Deep Diver',
    emoji: '🤿',
    description: 'Used "Hidden Gems" mode',
    rarity: 'common',
  },
  {
    id: 'wordsmith',
    name: 'Wordsmith',
    emoji: '📝',
    description: 'Wrote a free text prompt over 100 characters',
    rarity: 'uncommon',
  },

  // ── Social & Community ──
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    emoji: '🦋',
    description: 'Shared 5 game night invites',
    rarity: 'rare',
  },
  {
    id: 'game_group',
    name: 'Game Group',
    emoji: '👥',
    description: 'Created 3 named presets',
    rarity: 'uncommon',
  },
  {
    id: 'loyal_fan',
    name: 'Loyal Fan',
    emoji: '🏠',
    description: 'Visited the app 7 days in a row',
    rarity: 'rare',
  },

  // ── Reviews & Ratings ──
  {
    id: 'harsh_critic',
    name: 'Harsh Critic',
    emoji: '😤',
    description: 'Gave a game a 1/10 rating',
    rarity: 'uncommon',
  },
  {
    id: 'fanboy',
    name: 'Fanboy/Fangirl',
    emoji: '🥰',
    description: 'Gave a game a 10/10 rating',
    rarity: 'uncommon',
  },
  {
    id: 'essay_writer',
    name: 'Essay Writer',
    emoji: '📄',
    description: 'Wrote a review over 500 characters',
    rarity: 'rare',
  },
  {
    id: 'contrarian',
    name: 'Contrarian',
    emoji: '🤔',
    description: 'Rated a game 3+ points different from its average',
    rarity: 'rare',
  },

  // ── Profile & Settings ──
  {
    id: 'organized',
    name: 'Organized',
    emoji: '📋',
    description: 'Saved 5 named presets',
    rarity: 'uncommon',
  },
  {
    id: 'customizer',
    name: 'Customizer',
    emoji: '⚙️',
    description: 'Changed recommendation settings',
    rarity: 'common',
  },

  // ── Easter Eggs ──
  {
    id: 'forty_two',
    name: '42',
    emoji: '🌌',
    description: 'Found the answer to life, the universe, and everything',
    rarity: 'legendary',
  },
  {
    id: 'konami_code',
    name: 'Konami Code',
    emoji: '🎮',
    description: '↑↑↓↓←→←→BA',
    rarity: 'legendary',
  },
  {
    id: 'rick_rolled',
    name: 'Rick Rolled',
    emoji: '🎵',
    description: 'Never gonna give you up',
    rarity: 'legendary',
  },
  {
    id: 'secret_menu',
    name: 'Secret Menu',
    emoji: '🔐',
    description: 'Found the hidden roadmap page',
    rarity: 'rare',
  },

  // ── Milestones ──
  {
    id: 'founding_member',
    name: 'Founding Member',
    emoji: '🏅',
    description: 'Created an account in the first month of launch',
    rarity: 'legendary',
  },
  {
    id: 'veteran',
    name: 'Veteran',
    emoji: '🎖️',
    description: 'Account is 30+ days old',
    rarity: 'rare',
  },
  {
    id: 'power_user',
    name: 'Power User',
    emoji: '💪',
    description: 'Used 10+ different features in one session',
    rarity: 'rare',
  },
  {
    id: 'completionist_plus',
    name: 'Completionist+',
    emoji: '🌟',
    description: 'Unlocked every other achievement',
    rarity: 'legendary',
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
