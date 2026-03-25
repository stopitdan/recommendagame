/**
 * Rule-Based Recommendation Scoring Engine
 *
 * Scores candidate games against user preferences across multiple
 * weighted dimensions. Each dimension produces a 0-1 score, and the
 * final composite score is a weighted sum.
 *
 * Dimensions:
 *   1. Type match       — Does the game type match what they asked for?
 *   2. Player count fit — Does the game support their player count?
 *   3. Time fit         — Does the game fit in their available time?
 *   4. Complexity fit   — Is the complexity in their preferred range?
 *   5. Genre match      — How many of their preferred genres does this hit?
 *   6. Mood alignment   — Does the game's style match their mood/vibe?
 *   7. Quality signal   — Rating quality (higher = better)
 *   8. Popularity       — Community validation (log-scaled rating count)
 *
 * Each scored game includes human-readable "reasons" explaining
 * why it was recommended.
 */

import type { Game } from '@/types/game';
import type { QuestionnaireState, TimePreset } from '@/types/questionnaire';
import { TIME_PRESETS } from '@/types/questionnaire';

// ─── Types ───────────────────────────────────────────────────

export interface ScoredGame {
  game: Game;
  score: number;
  reasons: string[];
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  typeMatch: number;
  playerCountFit: number;
  timeFit: number;
  complexityFit: number;
  genreMatch: number;
  moodAlignment: number;
  qualitySignal: number;
  popularitySignal: number;
}

/** Weights for each scoring dimension (must sum to ~1.0) */
export interface ScoringWeights {
  typeMatch: number;
  playerCountFit: number;
  timeFit: number;
  complexityFit: number;
  genreMatch: number;
  moodAlignment: number;
  qualitySignal: number;
  popularitySignal: number;
}

// ─── Default Weights ─────────────────────────────────────────

export const DEFAULT_WEIGHTS: ScoringWeights = {
  typeMatch: 0.20,       // Most important — wrong type = wrong game
  playerCountFit: 0.18,  // Critical — can't play a 5p game with 2 people
  timeFit: 0.12,         // Important — but flexible (people will play longer if it's good)
  complexityFit: 0.10,   // Nice to have — less strict than hard constraints
  genreMatch: 0.15,      // Strong signal — genres drive taste
  moodAlignment: 0.10,   // Soft signal — vibes matter but are imprecise
  qualitySignal: 0.08,   // Tiebreaker — prefer well-rated games
  popularitySignal: 0.07, // Tiebreaker — prefer community-validated games
};

export const HIDDEN_GEMS_WEIGHTS: ScoringWeights = {
  ...DEFAULT_WEIGHTS,
  qualitySignal: 0.12,
  popularitySignal: 0.02,
  genreMatch: 0.16,
};

export const POPULAR_WEIGHTS: ScoringWeights = {
  ...DEFAULT_WEIGHTS,
  popularitySignal: 0.12,
  qualitySignal: 0.10,
  moodAlignment: 0.06,
};

// ─── Main Scoring Function ───────────────────────────────────

/**
 * Scores a list of candidate games against user preferences.
 * Returns scored games sorted by score (highest first).
 */
export function scoreGames(
  candidates: Game[],
  preferences: QuestionnaireState,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ScoredGame[] {
  return candidates
    .map((game) => scoreGame(game, preferences, weights))
    .sort((a, b) => b.score - a.score);
}

/**
 * Scores a single game against user preferences.
 */
export function scoreGame(
  game: Game,
  prefs: QuestionnaireState,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ScoredGame {
  const breakdown: ScoreBreakdown = {
    typeMatch: scoreTypeMatch(game, prefs.gameType),
    playerCountFit: scorePlayerCount(game, prefs.playerCount),
    timeFit: scoreTimeFit(game, prefs.timeAvailable),
    complexityFit: scoreComplexity(game, prefs.complexity),
    genreMatch: scoreGenreMatch(game, prefs.genres),
    moodAlignment: scoreMoodAlignment(game, prefs.moods),
    qualitySignal: scoreQuality(game),
    popularitySignal: scorePopularity(game),
  };

  // Weighted sum
  const score =
    breakdown.typeMatch * weights.typeMatch +
    breakdown.playerCountFit * weights.playerCountFit +
    breakdown.timeFit * weights.timeFit +
    breakdown.complexityFit * weights.complexityFit +
    breakdown.genreMatch * weights.genreMatch +
    breakdown.moodAlignment * weights.moodAlignment +
    breakdown.qualitySignal * weights.qualitySignal +
    breakdown.popularitySignal * weights.popularitySignal;

  const reasons = generateReasons(game, prefs, breakdown);

  return { game, score, reasons, breakdown };
}

// ─── Dimension Scorers (each returns 0-1) ────────────────────

/**
 * Type match: 1.0 if exact match, 0.5 if user didn't specify,
 * 0.0 if wrong type.
 */
function scoreTypeMatch(game: Game, preferredType: string | null): number {
  if (!preferredType) return 0.5; // No preference = neutral
  return game.types.includes(preferredType as Game['types'][number]) ? 1.0 : 0.0;
}

/**
 * Player count fit: 1.0 if the game's range overlaps perfectly with
 * the user's range. Partial credit for near-misses.
 */
function scorePlayerCount(
  game: Game,
  playerRange: { min: number; max: number },
): number {
  if (!game.playerCount) return 0.5; // Unknown = neutral

  const gameMin = game.playerCount.min;
  const gameMax = game.playerCount.max;
  const userMin = playerRange.min;
  const userMax = playerRange.max;

  // Perfect overlap: game supports at least part of user's range
  const overlapMin = Math.max(gameMin, userMin);
  const overlapMax = Math.min(gameMax, userMax);

  if (overlapMin <= overlapMax) {
    // There is overlap — score based on how much
    const userRange = userMax - userMin + 1;
    const overlapRange = overlapMax - overlapMin + 1;
    const overlapRatio = overlapRange / userRange;

    // Bonus if the game's recommended player count is in user's range
    const recBonus = game.playerCount.recommended &&
      game.playerCount.recommended >= userMin &&
      game.playerCount.recommended <= userMax
      ? 0.15
      : 0;

    return Math.min(0.6 + overlapRatio * 0.4 + recBonus, 1.0);
  }

  // No overlap — penalize based on distance
  const distance = overlapMin > overlapMax
    ? Math.min(Math.abs(gameMin - userMax), Math.abs(gameMax - userMin))
    : 0;

  // 1 player off = 0.3, 2 off = 0.15, 3+ off = 0
  return Math.max(0, 0.3 - (distance - 1) * 0.15);
}

/**
 * Time fit: 1.0 if game time falls within the user's preset range.
 * Partial credit for close misses.
 */
function scoreTimeFit(game: Game, timePreset: TimePreset | null): number {
  if (!timePreset) return 0.5; // No preference
  if (!game.playTime) return 0.4; // Unknown play time

  const preset = TIME_PRESETS[timePreset];
  const gameTime = game.playTime.average ?? game.playTime.min;
  if (!gameTime || gameTime === 0) return 0.4;

  // Within range = perfect
  if (gameTime >= preset.minMinutes && gameTime <= preset.maxMinutes) {
    return 1.0;
  }

  // How far outside the range?
  const distanceMin = Math.abs(gameTime - preset.minMinutes);
  const distanceMax = Math.abs(gameTime - preset.maxMinutes);
  const distance = Math.min(distanceMin, distanceMax);
  const rangeSize = preset.maxMinutes - preset.minMinutes;

  // Graceful falloff: half the range away = 0.5 score
  return Math.max(0, 1.0 - (distance / Math.max(rangeSize, 15)) * 0.8);
}

/**
 * Complexity fit: 1.0 if complexity is within range, graceful falloff outside.
 */
function scoreComplexity(
  game: Game,
  complexityRange: { min: number; max: number },
): number {
  if (game.complexity == null) return 0.5; // Unknown

  if (game.complexity >= complexityRange.min && game.complexity <= complexityRange.max) {
    return 1.0;
  }

  // Distance from nearest boundary
  const distance = game.complexity < complexityRange.min
    ? complexityRange.min - game.complexity
    : game.complexity - complexityRange.max;

  // 0.5 points off per unit of complexity distance
  return Math.max(0, 1.0 - distance * 0.5);
}

/**
 * Genre match: fraction of user's preferred genres that the game matches.
 * Checks categories, mechanics, and themes for matches.
 */
function scoreGenreMatch(game: Game, preferredGenres: string[]): number {
  if (preferredGenres.length === 0) return 0.5; // No preference

  const gameTags = [
    ...game.categories,
    ...game.mechanics,
    ...game.themes,
  ].map((t) => t.toLowerCase());

  let matches = 0;
  for (const genre of preferredGenres) {
    const lowerGenre = genre.toLowerCase();
    // Check for substring matches (e.g. "Strategy" matches "Abstract Strategy")
    if (gameTags.some((tag) => tag.includes(lowerGenre) || lowerGenre.includes(tag))) {
      matches++;
    }
  }

  // At least 1 match = good, more = better, diminishing returns
  if (matches === 0) return 0.1;
  const ratio = matches / preferredGenres.length;
  return 0.4 + ratio * 0.6; // 1 match out of 3 = 0.6, all match = 1.0
}

/**
 * Mood alignment: maps mood keywords to game characteristics.
 */
function scoreMoodAlignment(game: Game, moods: string[]): number {
  if (moods.length === 0) return 0.5;

  const gameTags = [
    ...game.categories,
    ...game.mechanics,
    ...game.themes,
  ].map((t) => t.toLowerCase());

  const gameDesc = game.description?.toLowerCase() ?? '';

  let score = 0;
  let checked = 0;

  for (const mood of moods) {
    checked++;
    switch (mood) {
      case 'competitive':
        if (!gameTags.some((t) => t.includes('cooperative') || t.includes('co-op'))) {
          score += 0.7; // Most games are competitive by default
        }
        if (gameTags.some((t) => t.includes('player elimination') || t.includes('auction') || t.includes('area control'))) {
          score += 0.3;
        }
        break;

      case 'cooperative':
        if (gameTags.some((t) => t.includes('cooperative') || t.includes('co-op') || t.includes('team'))) {
          score += 1.0;
        }
        break;

      case 'chill':
        if (game.complexity != null && game.complexity <= 2.5) score += 0.5;
        if (gameTags.some((t) => t.includes('family') || t.includes('party') || t.includes('casual'))) {
          score += 0.5;
        }
        break;

      case 'brain-teaser':
        if (game.complexity != null && game.complexity >= 3.0) score += 0.5;
        if (gameTags.some((t) => t.includes('strategy') || t.includes('puzzle') || t.includes('deduction') || t.includes('logic'))) {
          score += 0.5;
        }
        break;

      case 'social':
        if (gameTags.some((t) => t.includes('party') || t.includes('social') || t.includes('bluffing') || t.includes('negotiation') || t.includes('voting'))) {
          score += 1.0;
        } else if (game.playerCount && game.playerCount.max >= 5) {
          score += 0.4; // Large player count games tend to be social
        }
        break;

      case 'story-driven':
        if (gameTags.some((t) =>
          t.includes('narrative') || t.includes('story') || t.includes('campaign') ||
          t.includes('role playing') || t.includes('rpg') || t.includes('adventure')
        )) {
          score += 1.0;
        } else if (gameDesc.includes('story') || gameDesc.includes('narrative') || gameDesc.includes('campaign')) {
          score += 0.5;
        }
        break;
    }
  }

  return checked > 0 ? Math.min(score / checked, 1.0) : 0.5;
}

/**
 * Quality signal: normalized 0-10 rating to 0-1.
 */
function scoreQuality(game: Game): number {
  if (game.rating == null) return 0.3; // Unknown = slightly below average
  return game.rating / 10;
}

/**
 * Popularity signal: log-scaled rating count.
 * 10 ratings = ~0.2, 1000 = ~0.6, 100000 = ~1.0
 */
function scorePopularity(game: Game): number {
  const count = game.ratingCount ?? 0;
  if (count === 0) return 0;
  return Math.min(Math.log10(count) / 5, 1.0);
}

// ─── Reason Generation ───────────────────────────────────────

/**
 * Generates human-readable reasons for why a game was recommended.
 * Only includes reasons where the game scored well on that dimension.
 */
function generateReasons(
  game: Game,
  prefs: QuestionnaireState,
  breakdown: ScoreBreakdown,
): string[] {
  const reasons: string[] = [];

  // Type match
  if (breakdown.typeMatch >= 0.8 && prefs.gameType) {
    reasons.push(`It's a ${prefs.gameType} game, just what you asked for`);
  }

  // Player count
  if (breakdown.playerCountFit >= 0.8 && game.playerCount) {
    const { min, max, recommended } = game.playerCount;
    if (recommended && recommended >= prefs.playerCount.min && recommended <= prefs.playerCount.max) {
      reasons.push(`Best at ${recommended} players — right in your sweet spot`);
    } else if (min === max) {
      reasons.push(`Designed for exactly ${min} players`);
    } else {
      reasons.push(`Supports ${min}–${max} players`);
    }
  }

  // Time fit
  if (breakdown.timeFit >= 0.8 && game.playTime && prefs.timeAvailable) {
    const avg = game.playTime.average ?? game.playTime.min;
    if (avg) {
      if (avg < 30) reasons.push(`Quick to play (~${avg} min)`);
      else if (avg <= 60) reasons.push(`Fits nicely in about ${avg} minutes`);
      else reasons.push(`A satisfying ${Math.round(avg / 60)}+ hour experience`);
    }
  }

  // Complexity
  if (breakdown.complexityFit >= 0.8 && game.complexity != null) {
    if (game.complexity <= 2.0) reasons.push('Easy to learn and jump into');
    else if (game.complexity <= 3.0) reasons.push('Nice balance of depth and accessibility');
    else if (game.complexity <= 4.0) reasons.push('Meaty and strategic — lots to think about');
    else reasons.push('Deep and complex — a real brain workout');
  }

  // Genre match
  if (breakdown.genreMatch >= 0.6 && prefs.genres.length > 0) {
    const matchedGenres = prefs.genres.filter((genre) => {
      const lower = genre.toLowerCase();
      return [...game.categories, ...game.mechanics, ...game.themes]
        .some((t) => t.toLowerCase().includes(lower) || lower.includes(t.toLowerCase()));
    });
    if (matchedGenres.length > 0) {
      reasons.push(`Matches your taste for ${matchedGenres.slice(0, 2).join(' and ')}`);
    }
  }

  // Mood
  if (breakdown.moodAlignment >= 0.7 && prefs.moods.length > 0) {
    const moodLabels: Record<string, string> = {
      competitive: 'competitive',
      cooperative: 'cooperative',
      chill: 'chill and relaxing',
      'brain-teaser': 'a brain teaser',
      social: 'great for socializing',
      'story-driven': 'story-driven',
    };
    const matched = prefs.moods.find((m) => moodLabels[m]);
    if (matched) reasons.push(`Fits the ${moodLabels[matched]} vibe you're after`);
  }

  // Quality
  if (breakdown.qualitySignal >= 0.75 && game.rating != null) {
    reasons.push(`Rated ${game.rating.toFixed(1)}/10 by the community`);
  }

  // Fallback: always have at least one reason
  if (reasons.length === 0) {
    if (game.rating && game.rating >= 7.0) {
      reasons.push(`Highly rated at ${game.rating.toFixed(1)}/10`);
    } else {
      reasons.push('Matches your overall preferences');
    }
  }

  return reasons.slice(0, 3); // Max 3 reasons
}
