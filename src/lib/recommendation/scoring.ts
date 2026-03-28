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
import type { ParsedPreferences } from '@/lib/llm/types';

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
  freeTextMatch: number;
  qualitySignal: number;
  popularitySignal: number;
  recencyBoost: number;
}

/** Weights for each scoring dimension (must sum to ~1.0) */
export interface ScoringWeights {
  typeMatch: number;
  playerCountFit: number;
  timeFit: number;
  complexityFit: number;
  genreMatch: number;
  moodAlignment: number;
  freeTextMatch: number;
  qualitySignal: number;
  popularitySignal: number;
  recencyBoost: number;
}

// ─── Default Weights ─────────────────────────────────────────

export const DEFAULT_WEIGHTS: ScoringWeights = {
  typeMatch: 0.12,       // Hard-filtered already, this is for partial matches
  playerCountFit: 0.10,  // Hard-filtered already, this scores fit quality
  timeFit: 0.08,         // Hard-filtered already, this scores fit quality
  complexityFit: 0.08,   // Hard-filtered already, this scores fit quality
  genreMatch: 0.20,      // Primary relevance signal — genres/mechanics drive taste
  moodAlignment: 0.10,   // Important soft signal — vibes matter
  freeTextMatch: 0.14,   // Keywords from user's description are highly relevant
  qualitySignal: 0.05,   // Tiebreaker only — relevance beats ratings
  popularitySignal: 0.10, // Community validation — users expect recognizable games
  recencyBoost: 0.03,    // Mild freshness boost
};

export const HIDDEN_GEMS_WEIGHTS: ScoringWeights = {
  ...DEFAULT_WEIGHTS,
  qualitySignal: 0.08,
  popularitySignal: 0.01,
  genreMatch: 0.24,
  recencyBoost: 0.05,
};

export const POPULAR_WEIGHTS: ScoringWeights = {
  ...DEFAULT_WEIGHTS,
  popularitySignal: 0.14,
  qualitySignal: 0.08,
  genreMatch: 0.18,
  moodAlignment: 0.06,
  recencyBoost: 0.02,
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
    typeMatch: scoreTypeMatch(game, prefs.gameTypes),
    playerCountFit: scorePlayerCount(game, prefs.playerCount),
    timeFit: scoreTimeFit(game, prefs.timePresets),
    complexityFit: scoreComplexity(game, prefs.complexity),
    genreMatch: scoreGenreMatch(game, prefs.genres),
    moodAlignment: scoreMoodAlignment(game, prefs.moods),
    freeTextMatch: scoreFreeText(game, prefs.freeText, prefs.llmParsed),
    qualitySignal: scoreQuality(game),
    popularitySignal: scorePopularity(game),
    recencyBoost: scoreRecency(game),
  };

  // Weighted sum
  const score =
    breakdown.typeMatch * weights.typeMatch +
    breakdown.playerCountFit * weights.playerCountFit +
    breakdown.timeFit * weights.timeFit +
    breakdown.complexityFit * weights.complexityFit +
    breakdown.genreMatch * weights.genreMatch +
    breakdown.moodAlignment * weights.moodAlignment +
    breakdown.freeTextMatch * weights.freeTextMatch +
    breakdown.qualitySignal * weights.qualitySignal +
    breakdown.popularitySignal * weights.popularitySignal +
    breakdown.recencyBoost * weights.recencyBoost;

  const reasons = generateReasons(game, prefs, breakdown);

  return { game, score, reasons, breakdown };
}

// ─── Dimension Scorers (each returns 0-1) ────────────────────

/**
 * Type match: 1.0 if game matches any of the preferred types,
 * 0.5 if user didn't specify (empty array), 0.0 if no types match.
 */
function scoreTypeMatch(game: Game, preferredTypes: string[]): number {
  if (preferredTypes.length === 0) return 0.5; // No preference = neutral
  return preferredTypes.some((t) => game.types.includes(t as Game['types'][number])) ? 1.0 : 0.0;
}

/**
 * Player count fit: rewards games designed for the user's player count.
 *
 * Key insight: a "2-player game" (min=1, max=2) is much better for a
 * user who wants 1-2 players than a "party game" (min=2, max=10) that
 * technically supports 2. The scoring reflects this by measuring how
 * tightly the game's range matches the user's range.
 *
 * Score breakdown:
 *   1.0  — Game range is exactly the user's range, or recommended count matches
 *   0.8+ — Game range is a tight fit (e.g. 1-3 game for 1-2 request)
 *   0.5  — Game supports the range but is much broader (e.g. 2-8 for 1-2)
 *   0.0  — No overlap at all (hard fail, shouldn't reach scoring due to DB filter)
 */
function scorePlayerCount(
  game: Game,
  playerRange: { min: number; max: number },
): number {
  if (!game.playerCount) return 0.3; // Unknown = penalize slightly

  const gameMin = game.playerCount.min;
  const gameMax = game.playerCount.max;
  const userMin = playerRange.min;
  const userMax = playerRange.max;

  // No overlap at all — hard 0
  if (gameMin > userMax || gameMax < userMin) return 0.0;

  // Game supports the user's range. Now score by HOW WELL it fits.
  const userRange = userMax - userMin + 1;
  const gameRange = gameMax - gameMin + 1;

  // Tight fit ratio: how close is the game's range to the user's range?
  // A 1-2 game for a 1-2 request = ratio 1.0 (perfect)
  // A 2-8 game for a 1-2 request = ratio 0.29 (too broad)
  const tightness = Math.min(userRange / gameRange, 1.0);

  // Coverage: what fraction of the user's range does the game cover?
  const overlapMin = Math.max(gameMin, userMin);
  const overlapMax = Math.min(gameMax, userMax);
  const coverage = (overlapMax - overlapMin + 1) / userRange;

  // Base score from tightness and coverage
  let score = 0.3 + tightness * 0.4 + coverage * 0.2;

  // Bonus: recommended player count is in user's range
  if (game.playerCount.recommended &&
      game.playerCount.recommended >= userMin &&
      game.playerCount.recommended <= userMax) {
    score += 0.15;
  }

  // Bonus: game's range fits entirely within user's range (perfect match)
  if (gameMin >= userMin && gameMax <= userMax) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Time fit: 1.0 if game time falls within the union of all selected
 * preset ranges. Partial credit for close misses.
 * If multiple presets are selected, the union range spans min of all mins
 * to max of all maxes.
 */
function scoreTimeFit(game: Game, timePresets: TimePreset[]): number {
  if (timePresets.length === 0) return 0.5; // No preference
  if (!game.playTime) return 0.4; // Unknown play time

  const gameTime = game.playTime.average ?? game.playTime.min;
  if (!gameTime || gameTime === 0) return 0.4;

  // Compute union range across all selected presets
  const unionMin = Math.min(...timePresets.map((tp) => TIME_PRESETS[tp].minMinutes));
  const unionMax = Math.max(...timePresets.map((tp) => TIME_PRESETS[tp].maxMinutes));

  // Within union range = perfect
  if (gameTime >= unionMin && gameTime <= unionMax) {
    return 1.0;
  }

  // How far outside the union range?
  const distanceMin = Math.abs(gameTime - unionMin);
  const distanceMax = Math.abs(gameTime - unionMax);
  const distance = Math.min(distanceMin, distanceMax);
  const rangeSize = unionMax - unionMin;

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
    // Also check tokenized word overlap for BGG's compound mechanic names
    // (e.g. "Deck Building" should match "Deck, Bag, and Pool Building")
    const genreWords = lowerGenre.split(/[\s,]+/).filter((w) => w.length > 2);
    if (gameTags.some((tag) => {
      if (tag.includes(lowerGenre) || lowerGenre.includes(tag)) return true;
      // Tokenized match: if all significant words from the genre appear in the tag
      if (genreWords.length >= 2) {
        const tagWords = tag.split(/[\s,]+/);
        const wordMatches = genreWords.filter((gw) => tagWords.some((tw) => tw.includes(gw) || gw.includes(tw)));
        return wordMatches.length >= genreWords.length * 0.6; // 60% word overlap
      }
      return false;
    })) {
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
 * Free text keyword matching.
 *
 * Extracts meaningful keywords from the user's free text input and matches
 * them against the game's name, description, categories, mechanics, and themes.
 *
 * "I like roguelike games" → extracts ["roguelike"] → matches games with
 * "roguelike" in their categories, mechanics, themes, name, or description.
 *
 * Scoring:
 *   - 0.5 if no free text provided (neutral)
 *   - 0.0 if text provided but zero keyword matches
 *   - 0.4-1.0 based on number and quality of matches
 *   - Name matches weighted higher than description matches
 */
function scoreFreeText(
  game: Game,
  freeText: string,
  llmParsed?: ParsedPreferences | null,
): number {
  // If LLM-parsed data is available, use it (much more accurate)
  if (llmParsed && hasLLMData(llmParsed)) {
    return scoreFreeTextLLM(game, llmParsed);
  }

  // Fallback: regex keyword extraction
  return scoreFreeTextKeywords(game, freeText);
}

/** Check if LLM parsed data has any meaningful content */
function hasLLMData(parsed: ParsedPreferences): boolean {
  return (
    parsed.genres.length > 0 ||
    parsed.mechanics.length > 0 ||
    parsed.keywords.length > 0 ||
    parsed.similarTo.length > 0
  );
}

/**
 * Score using LLM-extracted structured data.
 * Much more precise than keyword matching because the LLM understands
 * "deck builder" is a mechanic, "roguelike" is a genre, etc.
 */
function scoreFreeTextLLM(game: Game, parsed: ParsedPreferences): number {
  const gameMechanics = game.mechanics.map((m) => m.toLowerCase());
  const gameCategories = game.categories.map((c) => c.toLowerCase());
  const gameThemes = game.themes.map((t) => t.toLowerCase());
  const gameName = game.name.toLowerCase();
  const gameDesc = (game.description ?? '').toLowerCase();
  const allTags = [...gameMechanics, ...gameCategories, ...gameThemes];

  let totalScore = 0;
  let totalChecks = 0;

  // Mechanics match (very strong signal — LLM identified specific mechanics)
  if (parsed.mechanics.length > 0) {
    let mechanicHits = 0;
    for (const mech of parsed.mechanics) {
      const lower = mech.toLowerCase();
      if (gameMechanics.some((gm) => gm.includes(lower) || lower.includes(gm))) {
        mechanicHits++;
      }
    }
    totalScore += (mechanicHits / parsed.mechanics.length) * 1.0;
    totalChecks++;
  }

  // Genre match (strong signal)
  if (parsed.genres.length > 0) {
    let genreHits = 0;
    for (const genre of parsed.genres) {
      const lower = genre.toLowerCase();
      if (allTags.some((tag) => tag.includes(lower) || lower.includes(tag))) {
        genreHits++;
      }
    }
    totalScore += (genreHits / parsed.genres.length) * 0.9;
    totalChecks++;
  }

  // Keywords match (moderate signal)
  if (parsed.keywords.length > 0) {
    let keywordHits = 0;
    for (const kw of parsed.keywords) {
      const lower = kw.toLowerCase();
      if (gameName.includes(lower) || allTags.some((t) => t.includes(lower)) || gameDesc.includes(lower)) {
        keywordHits++;
      }
    }
    totalScore += (keywordHits / parsed.keywords.length) * 0.6;
    totalChecks++;
  }

  if (totalChecks === 0) return 0.5;
  return Math.min(totalScore / totalChecks, 1.0);
}

/**
 * Fallback: score using regex keyword extraction.
 * Used when LLM parsing is unavailable or returned empty results.
 */
function scoreFreeTextKeywords(game: Game, freeText: string): number {
  if (!freeText || freeText.trim().length === 0) return 0.5;

  const keywords = extractKeywords(freeText);
  if (keywords.length === 0) return 0.5;

  const gameName = game.name.toLowerCase();
  const gameDesc = (game.description ?? '').toLowerCase();
  const gameTags = [
    ...game.categories,
    ...game.mechanics,
    ...game.themes,
  ].map((t) => t.toLowerCase());
  const allTagsStr = gameTags.join(' ');

  let totalScore = 0;
  let matchCount = 0;

  for (const keyword of keywords) {
    if (gameName.includes(keyword)) {
      totalScore += 1.0;
      matchCount++;
      continue;
    }
    if (gameTags.some((tag) => tag.includes(keyword) || keyword.includes(tag))) {
      totalScore += 0.9;
      matchCount++;
      continue;
    }
    if (allTagsStr.includes(keyword)) {
      totalScore += 0.7;
      matchCount++;
      continue;
    }
    if (gameDesc.includes(keyword)) {
      totalScore += 0.4;
      matchCount++;
    }
  }

  if (matchCount === 0) return 0.0;

  const avgQuality = totalScore / keywords.length;
  const coverageBonus = Math.min(matchCount / keywords.length, 1.0) * 0.2;

  return Math.min(avgQuality + coverageBonus, 1.0);
}

/** Stop words to filter out of free text */
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'a', 'an', 'the',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'shall',
  'and', 'or', 'but', 'if', 'so', 'for', 'of', 'to', 'in',
  'on', 'at', 'by', 'with', 'from', 'as', 'into', 'about',
  'like', 'want', 'need', 'looking', 'something', 'game', 'games',
  'play', 'playing', 'really', 'very', 'just', 'some', 'that',
  'this', 'it', 'its', 'not', 'no', 'also', 'too', 'more',
  'than', 'much', 'many', 'think', 'prefer', 'enjoy',
]);

/**
 * Extracts meaningful keywords from free text input.
 * Filters out stop words and keeps terms >= 3 chars.
 * Also handles multi-word game-related terms.
 */
function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();

  // Check for known multi-word terms first
  const multiWordTerms: string[] = [];
  const KNOWN_PHRASES = [
    'deck building', 'deck builder', 'worker placement', 'area control',
    'roll and write', 'push your luck', 'engine building', 'tile placement',
    'hand management', 'set collection', 'trick taking', 'social deduction',
    'hidden role', 'resource management', 'card drafting', 'dungeon crawler',
    'dungeon crawl', 'real time', 'role playing', 'tower defense',
    'open world', 'first person', 'third person', 'turn based',
    'point and click', 'side scroller', 'beat em up', 'hack and slash',
    'battle royale', 'city builder', 'grand strategy', 'four x', '4x',
  ];

  for (const phrase of KNOWN_PHRASES) {
    if (lower.includes(phrase)) {
      multiWordTerms.push(phrase);
    }
  }

  // Extract single words, filter stop words
  const words = lower
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  // Deduplicate
  const all = [...new Set([...multiWordTerms, ...words])];

  return all;
}

/**
 * Recency boost: newer games get a mild boost.
 *
 * Scoring:
 *   - Released this year or last year: 1.0
 *   - Released 2-5 years ago: 0.7-0.9
 *   - Released 5-15 years ago: 0.3-0.6
 *   - Released 15+ years ago: 0.1-0.2
 *   - Unknown year: 0.3 (neutral)
 *
 * This prevents the recommendation engine from only surfacing
 * 20-year-old classics while newer games get buried.
 */
function scoreRecency(game: Game): number {
  if (!game.yearPublished) return 0.3;

  const currentYear = new Date().getFullYear();
  const age = currentYear - game.yearPublished;

  if (age <= 1) return 1.0;
  if (age <= 3) return 0.85;
  if (age <= 5) return 0.7;
  if (age <= 10) return 0.5;
  if (age <= 15) return 0.3;
  if (age <= 25) return 0.2;
  return 0.1;
}

/**
 * Quality signal: normalized 0-10 rating to 0-1.
 */
function scoreQuality(game: Game): number {
  if (game.rating == null) return 0.3; // Unknown = slightly below average
  return game.rating / 10;
}

/**
 * Popularity signal: log-scaled rating count with notability tiers.
 *
 * The base log scale rewards community validation, but we add tier
 * bonuses to ensure well-known games meaningfully outscore obscure ones:
 *   - 10,000+ ratings: universally known (Catan, Dominion) → bonus +0.15
 *   - 1,000+ ratings:  well-known in hobby → bonus +0.08
 *   - 100+ ratings:    community-validated → bonus +0.03
 *   - <100 ratings:    obscure, no bonus
 *
 * This prevents a game with 47 ratings and a 9.2 average from
 * outranking Dominion (50k ratings, 7.6 average) when someone
 * asks for "deck building games".
 */
function scorePopularity(game: Game): number {
  const count = game.ratingCount ?? 0;
  if (count === 0) return 0;

  // Base: log-scaled (10→0.2, 100→0.4, 1000→0.6, 10000→0.8, 100000→1.0)
  const base = Math.min(Math.log10(count) / 5, 1.0);

  // Notability tier bonus
  let bonus = 0;
  if (count >= 10_000) bonus = 0.15;
  else if (count >= 1_000) bonus = 0.08;
  else if (count >= 100) bonus = 0.03;

  return Math.min(base + bonus, 1.0);
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
  if (breakdown.typeMatch >= 0.8 && prefs.gameTypes.length > 0) {
    const matchedType = prefs.gameTypes.find((t) => game.types.includes(t as Game['types'][number]));
    if (matchedType) reasons.push(`It's a ${matchedType} game, just what you asked for`);
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
  if (breakdown.timeFit >= 0.8 && game.playTime && prefs.timePresets.length > 0) {
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

  // Free text match
  if (breakdown.freeTextMatch >= 0.5 && prefs.freeText && prefs.freeText.trim()) {
    const keywords = extractKeywords(prefs.freeText);
    const gameTags = [...game.categories, ...game.mechanics, ...game.themes].map((t) => t.toLowerCase());
    const matched = keywords.filter((kw) =>
      game.name.toLowerCase().includes(kw) ||
      gameTags.some((tag) => tag.includes(kw) || kw.includes(tag))
    );
    if (matched.length > 0) {
      reasons.push(`Matches "${matched.slice(0, 2).join('", "')}" from your description`);
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

  // Recency
  if (breakdown.recencyBoost >= 0.85 && game.yearPublished) {
    const currentYear = new Date().getFullYear();
    if (game.yearPublished >= currentYear) {
      reasons.push(`Brand new — released in ${game.yearPublished}`);
    } else if (game.yearPublished >= currentYear - 1) {
      reasons.push(`Recently released (${game.yearPublished})`);
    }
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
