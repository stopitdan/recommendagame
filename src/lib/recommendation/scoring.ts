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
import { mechanicMatches } from './mechanic-aliases';

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
  typeMatch: 0.10,       // Hard-filtered already, this is for partial matches
  playerCountFit: 0.08,  // Hard-filtered already, this scores fit quality
  timeFit: 0.07,         // Hard-filtered already, this scores fit quality
  complexityFit: 0.07,   // Hard-filtered already, this scores fit quality
  genreMatch: 0.26,      // PRIMARY relevance signal — user taste (was 0.28, -0.02 to fund popularity)
  moodAlignment: 0.08,   // Soft signal — vibes
  freeTextMatch: 0.22,   // User's exact words are high-intent
  qualitySignal: 0.05,   // Quality matters -- a 5.0 vs 8.5 game should be distinguishable
  popularitySignal: 0.06, // Canonical game tiebreaker — ensures Dominion beats Colony (was 0.04, +0.02)
  recencyBoost: 0.01,    // Mild freshness boost (reduced to fund quality)
};

/**
 * Hidden gems: high quality signal, near-zero popularity signal.
 * We WANT obscure games that the few people who played them loved.
 */
export const HIDDEN_GEMS_WEIGHTS: ScoringWeights = {
  ...DEFAULT_WEIGHTS,
  qualitySignal: 0.15,
  popularitySignal: 0.00,
  genreMatch: 0.22,
  freeTextMatch: 0.16,
  recencyBoost: 0.05,
};

/**
 * @deprecated Use DEFAULT_WEIGHTS instead. Kept for backwards compat
 * with any code that references it during the transition.
 */
export const POPULAR_WEIGHTS: ScoringWeights = DEFAULT_WEIGHTS;

// ─── Adaptive Weight Computation ────────────────────────────

/**
 * Amplifies scoring weights based on what the user emphasized in their query.
 *
 * Research backing: Arxiv survey (2407.13699) discusses contextual weight
 * adjustment. Koch (Criteo) recommends a trained meta-learner. This is
 * the rules-based approach that doesn't require ML training data.
 *
 * Example: "90 minutes, 4 players" -> timeFit and playerCountFit get 2-2.5x
 * boost, then all weights are renormalized to sum to 1.0.
 */
function computeAdaptiveWeights(
  baseWeights: ScoringWeights,
  prefs: QuestionnaireState,
): ScoringWeights {
  const w = { ...baseWeights };
  const llm = prefs.llmParsed;

  // Tight player count = user is specific about group size
  const pcRange = prefs.playerCount.max - prefs.playerCount.min;
  if (pcRange <= 1 && prefs.playerCount.min > 0 && prefs.playerCount.max < 10) {
    w.playerCountFit *= 2.0;
  } else if (pcRange <= 3 && prefs.playerCount.min > 1) {
    w.playerCountFit *= 1.5;
  }

  // Hard time constraint = user really means it
  if (llm?.timeStrictness === 'hard' && llm.maxMinutes) {
    w.timeFit *= 2.5;
  } else if (llm?.maxMinutes || prefs.timePresets.length > 0) {
    w.timeFit *= 1.5;
  }

  // Narrow complexity range = user knows what weight they want
  const cxRange = prefs.complexity.max - prefs.complexity.min;
  if (cxRange <= 1 && (prefs.complexity.min > 1 || prefs.complexity.max < 5)) {
    w.complexityFit *= 2.0;
  } else if (cxRange <= 2) {
    w.complexityFit *= 1.3;
  }

  // Multiple moods or specific social moods = vibe-heavy query
  if (prefs.moods.length >= 2) {
    w.moodAlignment *= 1.5;
  }

  // Broad query quality tiebreaker: when query has few constraints, boost
  // quality/popularity so that among equally-relevant games, the community's
  // top picks (Dominion for deck building, Codenames for party) rise to the top.
  const constraintCount = [
    pcRange <= 3 && prefs.playerCount.min > 1,
    llm?.maxMinutes != null,
    cxRange <= 2 && (prefs.complexity.min > 1 || prefs.complexity.max < 5),
    prefs.moods.length > 0,
    (llm?.designers?.length ?? 0) > 0,
    (llm?.similarTo?.length ?? 0) > 0,
    (llm?.excludedGenres?.length ?? 0) > 0,
  ].filter(Boolean).length;

  if (constraintCount <= 1) {
    // Very broad query ("deck building game") — canonical games must surface
    w.qualitySignal *= 6.0;
    w.popularitySignal *= 6.0;
  } else if (constraintCount === 2) {
    w.qualitySignal *= 3.0;
    w.popularitySignal *= 3.0;
  } else if (constraintCount >= 3) {
    // Multi-constraint queries: hard filters already prune irrelevant games,
    // so popularity should still serve as a tiebreaker among survivors
    w.popularitySignal = Math.max(w.popularitySignal, 0.05);
  }

  // Renormalize to sum to 1.0
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const key of Object.keys(w) as (keyof ScoringWeights)[]) {
      w[key] /= sum;
    }
  }

  return w;
}

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
    timeFit: scoreTimeFit(game, prefs.timePresets, prefs.llmParsed),
    complexityFit: scoreComplexity(game, prefs.complexity),
    genreMatch: scoreGenreMatch(game, prefs.genres),
    moodAlignment: scoreMoodAlignment(game, prefs.moods),
    freeTextMatch: scoreFreeText(game, prefs.freeText, prefs.llmParsed),
    qualitySignal: scoreQuality(game, weights === HIDDEN_GEMS_WEIGHTS),
    popularitySignal: scorePopularity(game),
    recencyBoost: scoreRecency(game),
  };

  // When the user's query has a very specific intent (designer, similar-to),
  // the freeTextMatch signal should dominate scoring. Otherwise a popular
  // game tagged "Strategy" outscores the exact designer the user asked for
  // because freeTextMatch is only 14% of the default weight.
  let effectiveWeights = weights;
  const llm = prefs.llmParsed;
  if (llm && ((llm.designers?.length ?? 0) > 0 || (llm.similarTo?.length ?? 0) > 0)) {
    effectiveWeights = {
      ...weights,
      freeTextMatch: 0.45,
      genreMatch: 0.10,
      popularitySignal: 0.08,
      qualitySignal: 0.02,
    };
  }

  // Query-adaptive weight amplification: when the user emphasized specific
  // constraints, amplify those dimensions so they matter more in ranking.
  // This prevents "90 minutes, 4 players" from returning 3-hour games.
  effectiveWeights = computeAdaptiveWeights(effectiveWeights, prefs);

  // Weighted sum
  const score =
    breakdown.typeMatch * effectiveWeights.typeMatch +
    breakdown.playerCountFit * effectiveWeights.playerCountFit +
    breakdown.timeFit * effectiveWeights.timeFit +
    breakdown.complexityFit * effectiveWeights.complexityFit +
    breakdown.genreMatch * effectiveWeights.genreMatch +
    breakdown.moodAlignment * effectiveWeights.moodAlignment +
    breakdown.freeTextMatch * effectiveWeights.freeTextMatch +
    breakdown.qualitySignal * effectiveWeights.qualitySignal +
    breakdown.popularitySignal * effectiveWeights.popularitySignal +
    breakdown.recencyBoost * effectiveWeights.recencyBoost;

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
 *
 * Also uses LLM-parsed maxMinutes/timeStrictness when no UI presets are
 * selected, so "under 30 minutes" in free text actually scores time fit.
 */
function scoreTimeFit(
  game: Game,
  timePresets: TimePreset[],
  llmParsed?: ParsedPreferences | null,
): number {
  // Determine time range from UI presets or LLM-parsed time constraints
  let unionMin = 0;
  let unionMax = Infinity;
  let hasConstraint = false;

  if (timePresets.length > 0) {
    unionMin = Math.min(...timePresets.map((tp) => TIME_PRESETS[tp].minMinutes));
    unionMax = Math.max(...timePresets.map((tp) => TIME_PRESETS[tp].maxMinutes));
    hasConstraint = true;
  } else if (llmParsed?.maxMinutes) {
    // Use LLM-extracted time: "under 30 minutes" -> maxMinutes=30
    unionMax = llmParsed.maxMinutes;
    unionMin = 0;
    hasConstraint = true;
  }

  if (!hasConstraint) return 0.5; // No preference
  if (!game.playTime) return 0.4; // Unknown play time

  const gameTime = game.playTime.average ?? game.playTime.min;
  if (!gameTime || gameTime === 0) return 0.4;

  // Within union range = perfect
  if (gameTime >= unionMin && gameTime <= unionMax) {
    return 1.0;
  }

  // How far outside the union range?
  const distanceMin = Math.abs(gameTime - unionMin);
  const distanceMax = Math.abs(gameTime - unionMax);
  const distance = Math.min(distanceMin, distanceMax);
  const rangeSize = unionMax - unionMin;

  // Smooth exponential decay instead of cliff: half-range away ≈ 0.37, full range ≈ 0.14
  return Math.exp((-distance / Math.max(rangeSize, 15)) * 2);
}

/**
 * Complexity fit: 1.0 if complexity is within range, graceful falloff outside.
 */
function scoreComplexity(
  game: Game,
  complexityRange: { min: number; max: number },
): number {
  // Missing complexity when user specified a range = penalize (they care about it)
  if (game.complexity == null) return 0.2;

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
    // Include enriched metadata tags for better matching (LLM-generated vibes, moods, etc.)
    ...(game.enrichedMetadata?.moods ?? []),
    ...(game.enrichedMetadata?.vibeKeywords ?? []),
    ...(game.enrichedMetadata?.targetAudience ?? []),
    ...(game.enrichedMetadata?.refinedMechanics ?? []),
  ].map((t) => t.toLowerCase());

  // Genre aliases: user vocabulary -> BGG taxonomy terms
  // "Dungeon Crawler" isn't a BGG tag, but maps to these categories/mechanics
  // Genre expansion: maps user vocabulary to tags that actually exist in the DB.
  // Covers BGG categories/mechanics, IGDB categories/mechanics/themes, and RAWG categories.
  // Each entry maps a user term to ALL synonyms/variants across all data sources.
  const GENRE_EXPANSION: Record<string, string[]> = {
    // ─── RPG / Dungeon ────────────────────────────────────────
    'dungeon crawler': ['adventure', 'fantasy', 'miniatures', 'cooperative game', 'modular board', 'fighting', 'hack and slash/beat \'em up'],
    'dungeon crawl': ['adventure', 'fantasy', 'miniatures', 'cooperative game', 'modular board', 'fighting'],
    'rpg': ['adventure', 'fantasy', 'fighting', 'variable player powers', 'scenario / mission / campaign game', 'role-playing (rpg)'],
    'role playing': ['adventure', 'fantasy', 'variable player powers', 'role-playing (rpg)', 'role playing'],
    'jrpg': ['role-playing (rpg)', 'fantasy', 'adventure', 'anime', 'turn-based'],
    'campaign': ['scenario / mission / campaign game', 'legacy game'],
    'legacy': ['legacy game', 'scenario / mission / campaign game'],

    // ─── Video Game Genres (IGDB/RAWG categories + BGG) ──────
    'roguelike': ['adventure', 'variable player powers', 'modular board'],
    'roguelite': ['adventure', 'variable player powers'],
    'tower defense': ['strategy', 'real time strategy (rts)'],
    'city builder': ['economic', 'city building', 'simulator', 'simulation', 'management'],
    'simulation': ['simulator', 'simulation', 'economic'],
    'simulator': ['simulator', 'simulation'],
    '4x': ['exploration', 'economic', 'civilization', '4x (explore, expand, exploit, and exterminate)'],
    'battle royale': ['player elimination', 'fighting', 'shooter'],
    'survival': ['adventure', 'horror', 'survival'],
    'crafting': ['hand management', 'set collection', 'survival'],
    'platformer': ['action / dexterity', 'adventure', 'platform', '3d platformer', 'side-scrolling'],
    'metroidvania': ['adventure', 'exploration', 'platform', 'side-scrolling'],
    'sandbox': ['exploration', 'modular board', 'sandbox', 'open world'],
    'open world': ['sandbox', 'open world', 'exploration', 'adventure'],
    'mmo': ['adventure', 'fantasy', 'fighting', 'massively multiplayer'],
    'mmorpg': ['adventure', 'fantasy', 'role-playing (rpg)', 'massively multiplayer'],
    'fps': ['fighting', 'action / dexterity', 'shooter', 'first person'],
    'shooter': ['fighting', 'action / dexterity', 'shooter', 'first person', 'third person'],
    'third person': ['third person', 'adventure'],
    'hack and slash': ['hack and slash/beat \'em up', 'fighting', 'action'],
    'beat em up': ['hack and slash/beat \'em up', 'fighting', 'action'],
    'fighting game': ['fighting', 'martial arts'],
    'visual novel': ['visual novel', 'storytelling', 'story driven'],
    'point and click': ['point-and-click', 'adventure', 'puzzle'],
    'rhythm': ['music', 'real-time'],
    'indie': ['indie'],
    'retro': ['arcade', 'retro'],
    'arcade': ['arcade'],
    'moba': ['moba', 'strategy', 'fighting'],
    'turn based': ['turn-based', 'turn-based strategy (tbs)'],
    'real time strategy': ['real time strategy (rts)', 'real-time', 'strategy'],
    'rts': ['real time strategy (rts)', 'real-time', 'strategy'],
    'tactical': ['tactical', 'strategy', 'turn-based strategy (tbs)'],
    'stealth': ['stealth', 'adventure'],
    'narrative': ['story driven', 'storytelling', 'cinematic'],
    'story driven': ['story driven', 'storytelling', 'cinematic', 'narrative'],
    'casual': ['casual', 'family'],
    'soulslike': ['adventure', 'fighting', 'boss fight'],

    // ─── Media / IP ──────────────────────────────────────────
    'tv show': ['movies / tv / radio theme', 'movies/tv/radio theme', 'video game theme'],
    'tv': ['movies / tv / radio theme', 'movies/tv/radio theme'],
    'movie': ['movies / tv / radio theme', 'movies/tv/radio theme', 'novel-based'],
    'film': ['movies / tv / radio theme', 'movies/tv/radio theme'],
    'licensed': ['movies / tv / radio theme', 'video game theme', 'novel-based', 'licensed game'],
    'adaptation': ['movies / tv / radio theme', 'video game theme', 'novel-based'],
    'book': ['novel-based'],
    'comic': ['comic book / strip'],
    'anime': ['anime', 'comic book / strip', 'japanese', 'manga'],
    'manga': ['anime', 'comic book / strip', 'japanese', 'manga'],
    'japanese': ['anime', 'japanese', 'manga'],
    'video game': ['video game theme'],

    // ─── Themes / Settings ───────────────────────────────────
    'zombie': ['zombies', 'horror', 'fighting', 'survival'],
    'zombies': ['zombies', 'horror', 'fighting', 'survival'],
    'pirate': ['pirates', 'nautical', 'adventure'],
    'space': ['science fiction', 'space exploration'],
    'sci-fi': ['science fiction', 'space exploration'],
    'scifi': ['science fiction'],
    'science fiction': ['science fiction', 'sci-fi'],
    'fantasy': ['fantasy'],
    'medieval': ['medieval', 'fantasy', 'historical'],
    'historical': ['historical', 'medieval', 'ancient'],
    'western': ['american west'],
    'war': ['wargame', 'fighting', 'world war ii', 'warfare'],
    'warfare': ['wargame', 'warfare', 'fighting'],
    'ww2': ['world war ii', 'wargame', 'warfare'],
    'wwii': ['world war ii', 'wargame', 'warfare'],
    'vietnam': ['wargame', 'modern warfare'],
    'ancient': ['ancient', 'civilization', 'historical'],
    'roman': ['ancient', 'civilization', 'historical'],
    'egyptian': ['ancient', 'civilization', 'historical'],
    'viking': ['medieval', 'fighting', 'adventure', 'historical'],
    'norse': ['medieval', 'mythology'],
    'dragon': ['fantasy', 'adventure', 'mythology'],
    'lovecraft': ['horror', 'novel-based', 'mythology'],
    'cthulhu': ['horror', 'novel-based', 'mythology'],
    'steampunk': ['science fiction', 'fantasy'],
    'cyberpunk': ['science fiction'],
    'post-apocalyptic': ['science fiction', 'adventure', 'post-apocalyptic', 'survival'],
    'apocalypse': ['science fiction', 'adventure', 'horror', 'post-apocalyptic'],
    'nature': ['animals', 'environmental'],
    'animals': ['animals'],
    'dinosaur': ['animals', 'prehistoric'],
    'food': ['food / cooking'],
    'cooking': ['food / cooking'],
    'farming': ['farming', 'economic'],
    'trains': ['trains', 'transportation'],
    'racing': ['racing'],
    'sports': ['sports', 'sport'],
    'detective': ['deduction', 'mystery'],
    'mystery': ['mystery', 'deduction'],
    'murder mystery': ['mystery', 'deduction', 'horror', 'thriller'],
    'thriller': ['thriller', 'mystery', 'horror'],
    'crime': ['mystery', 'deduction'],
    'spy': ['spies/secret agents', 'deduction', 'stealth'],
    'espionage': ['spies/secret agents', 'deduction', 'stealth'],
    'magic': ['fantasy', 'magic'],
    'wizard': ['fantasy', 'magic'],
    'superhero': ['comic book / strip', 'fighting', 'action'],
    'horror': ['horror'],
    'action': ['action', 'fighting', 'adventure'],
    'adventure': ['adventure'],
    'comedy': ['humor', 'comedy', 'funny'],
    'romance': ['romance'],
    'drama': ['drama', 'story driven'],
    'robots': ['science fiction', 'robots'],
    'aliens': ['science fiction', 'aliens'],

    // ─── Moods / Feelings ────────────────────────────────────
    'scary': ['horror'],
    'spooky': ['horror'],
    'creepy': ['horror'],
    'relaxing': ['family', 'casual', 'cozy'],
    'cozy': ['family', 'casual', 'cute', 'cozy'],
    'chill': ['family', 'casual'],
    'funny': ['humor', 'party game', 'comedy', 'funny'],
    'humor': ['humor', 'party game', 'comedy'],
    'emotional': ['drama', 'emotional', 'story driven'],
    'educational': ['educational'],
    'trivia': ['trivia', 'quiz/trivia'],
    'word game': ['word game'],
    'words': ['word game'],
    'math': ['math', 'number'],
    'puzzle': ['puzzle'],
    'abstract': ['abstract strategy'],
    'dexterity': ['action / dexterity'],
    'party': ['party game', 'party'],
    'family': ['family', "children's game", 'kids', 'family friendly'],
    'kids': ["children's game", 'family', 'kids', 'family friendly'],
    'children': ["children's game", 'family', 'kids'],
    'adult': ['mature / adult', 'party game'],
    'drinking': ['party game', 'mature / adult'],

    // ─── Mechanics (user language → DB tags) ─────────────────
    'trading': ['trading', 'negotiation'],
    'negotiation': ['negotiation', 'trading'],
    'bluffing': ['bluffing', 'betting and bluffing'],
    'betting': ['auction/bidding', 'push your luck', 'betting and bluffing'],
    'gambling': ['push your luck', 'auction/bidding', 'betting and bluffing'],
    'hidden role': ['hidden roles', 'traitor game'],
    'social deduction': ['social deduction', 'hidden roles', 'traitor game', 'deduction'],
    'traitor': ['traitor game', 'hidden roles'],
    'cooperative': ['cooperative game', 'co-operative', 'cooperative'],
    'co-op': ['cooperative game', 'co-operative', 'cooperative'],
    'coop': ['cooperative game', 'co-operative', 'cooperative'],
    'multiplayer': ['multiplayer', 'team-based game'],
    'split screen': ['split screen', 'co-operative', 'multiplayer'],
    'solo': ['solo / solitaire game', 'single player'],
    'solitaire': ['solo / solitaire game', 'single player'],
    'single player': ['solo / solitaire game', 'single player'],
    'team': ['team-based game', 'cooperative game', 'co-operative'],
    'drafting': ['drafting', 'card drafting', 'open drafting'],
    'deckbuilder': ['deck, bag, and pool building'],
    'deck builder': ['deck, bag, and pool building'],
    'deck building': ['deck, bag, and pool building'],
    'worker placement': ['worker placement'],
    'area control': ['area control / area influence', 'area majority / influence'],
    'tile placement': ['tile placement'],
    'dice': ['dice rolling'],
    'card game': ['card game', 'card & board game'],
    'board game': ['card & board game'],
    'miniatures': ['miniatures'],
    'wargame': ['wargame', 'warfare'],
    'economic': ['economic', 'management'],
    'engine building': ['income', 'engine building'],
    'trick taking': ['trick-taking'],
    'auction': ['auction/bidding', 'auction / bidding'],
    'deduction': ['deduction'],
    'real time': ['real-time'],
    'speed': ['real-time', 'action / dexterity'],
    'exploration': ['exploration', 'open world'],
    'management': ['management', 'economic', 'simulator'],
    'resource management': ['economic', 'management', 'hand management'],
    'strategy': ['strategy', 'tactical'],
  };

  // For each preferred genre, check if the game matches it OR any of its expansions.
  // Count one match per preferred genre (not per expansion term), so expansions
  // help find matches but don't inflate the score.
  let matches = 0;
  for (const genre of preferredGenres) {
    // Build the list of terms that satisfy this genre: the genre itself + expansions
    const termsForGenre = [genre];
    const expansion = GENRE_EXPANSION[genre.toLowerCase()];
    if (expansion) termsForGenre.push(...expansion);

    // Check if any term matches any game tag
    const matched = termsForGenre.some((term) => {
      const lowerTerm = term.toLowerCase();
      const termWords = lowerTerm.split(/[\s,]+/).filter((w) => w.length > 2);
      return gameTags.some((tag) => {
        if (tag.includes(lowerTerm) || lowerTerm.includes(tag)) return true;
        // Tokenized match for compound names (e.g. "Deck Building" ↔ "Deck, Bag, and Pool Building")
        if (termWords.length >= 2) {
          const tagWords = tag.split(/[\s,]+/);
          const wordMatches = termWords.filter((tw) => tagWords.some((gw) => gw.includes(tw) || tw.includes(gw)));
          return wordMatches.length >= termWords.length * 0.6;
        }
        return false;
      });
    });

    if (matched) matches++;
  }

  // Zero matches = zero score. If the user asked for anime and this game
  // has nothing anime-related, it shouldn't get any genre credit at all.
  if (matches === 0) return 0.0;
  const ratio = matches / preferredGenres.length;
  return 0.4 + ratio * 0.6; // 1 match out of 3 = 0.6, all match = 1.0
}

/**
 * Mood alignment: maps mood keywords to game characteristics.
 */
function scoreMoodAlignment(game: Game, moods: string[]): number {
  if (moods.length === 0) return 0.5;

  // If game has LLM-enriched mood tags, use them directly (much more accurate)
  const enrichedMoods = game.enrichedMetadata?.moods?.map(m => m.toLowerCase()) ?? [];
  if (enrichedMoods.length > 0) {
    let matches = 0;
    for (const mood of moods) {
      if (enrichedMoods.some(em => em.includes(mood) || mood.includes(em))) {
        matches++;
      }
    }
    // Enriched moods are high-confidence; blend with heuristic score below
    const enrichedScore = moods.length > 0 ? matches / moods.length : 0.5;
    // If enriched gave a strong signal, return it directly
    if (enrichedScore >= 0.5) return enrichedScore;
    // Otherwise fall through to heuristic scoring as supplement
  }

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

      case 'chill': {
        let chillScore = 0;
        // Low complexity is the strongest chill signal
        if (game.complexity != null && game.complexity <= 2.5) chillScore += 0.4;
        // Classic chill tags
        if (gameTags.some((t) => t.includes('family') || t.includes('party') || t.includes('casual'))) {
          chillScore += 0.25;
        }
        // Intimate 2-player + low complexity = quintessentially chill (Patchwork, Jaipur)
        if (game.playerCount && game.playerCount.max <= 2 && game.complexity != null && game.complexity < 2.5) {
          chillScore += 0.2;
        }
        // Abstract/set-collection/pattern games feel chill even without "family" tag
        if (gameTags.some((t) => t.includes('abstract') || t.includes('set collection') || t.includes('pattern') || t.includes('card game'))) {
          chillScore += 0.15;
        }
        // Short games feel chill
        if (game.playTime?.average && game.playTime.average < 45) chillScore += 0.1;
        score += Math.min(chillScore, 1.0);
        break;
      }

      case 'brain-teaser': {
        let brainScore = 0;
        if (game.complexity != null && game.complexity >= 3.0) brainScore += 0.5;
        if (gameTags.some((t) => t.includes('abstract strategy') || t.includes('spatial') || t.includes('logic'))) {
          brainScore += 0.4;
        }
        if (gameTags.some((t) => t.includes('strategy') || t.includes('puzzle') || t.includes('deduction'))) {
          brainScore += 0.3;
        }
        score += Math.min(brainScore, 1.0);
        break;
      }

      case 'social': {
        let socialScore = 0;
        if (gameTags.some((t) => t.includes('party') || t.includes('social') || t.includes('bluffing') || t.includes('negotiation'))) {
          socialScore += 0.6;
        }
        if (gameTags.some((t) => t.includes('humor') || t.includes('communication limits') || t.includes('word game') || t.includes('trivia'))) {
          socialScore += 0.4;
        }
        if (game.playerCount && game.playerCount.max >= 5) socialScore += 0.2;
        score += Math.min(socialScore, 1.0);
        break;
      }

      case 'story-driven': {
        let storyScore = 0;
        // Campaign = long story commitment, weight it higher
        if (gameTags.some((t) => t.includes('campaign') || t.includes('legacy'))) {
          storyScore += 0.6;
        }
        // Narrative = any story element
        if (gameTags.some((t) => t.includes('narrative') || t.includes('story') || t.includes('role playing') || t.includes('rpg') || t.includes('adventure'))) {
          storyScore += 0.4;
        }
        if (storyScore === 0 && (gameDesc.includes('story') || gameDesc.includes('narrative'))) {
          storyScore += 0.3;
        }
        score += Math.min(storyScore, 1.0);
        break;
      }
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
    parsed.similarTo.length > 0 ||
    (parsed.designers?.length ?? 0) > 0
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
  const gameDesigners = (game.designers ?? []).map((d) => d.toLowerCase());
  const allTags = [...gameMechanics, ...gameCategories, ...gameThemes];

  let totalScore = 0;
  let totalChecks = 0;

  // Designer match (strongest signal -- if user asked for a specific designer,
  // this should dominate. A game by the right designer scores 1.0, wrong designer 0.0)
  // Designer match: binary gate. Right designer = massive boost, wrong = penalty.
  if (parsed.designers?.length > 0) {
    let designerHits = 0;
    for (const designer of parsed.designers) {
      const lower = designer.toLowerCase();
      if (gameDesigners.some((gd) => gd.includes(lower) || lower.includes(gd))) {
        designerHits++;
      }
    }
    const designerRatio = designerHits / parsed.designers.length;
    if (designerRatio > 0) {
      totalScore += 1.5; // Right designer: strong boost (same scale as mechanics)
    } else {
      totalScore -= 0.8; // Wrong designer: heavy penalty
    }
    totalChecks++;
  }

  // Franchise/IP match: if user searched for a franchise name and the game's
  // title contains it, this is the strongest relevance signal. "Resident Evil"
  // should surface "Resident Evil: The Board Game" at the very top.
  if (parsed.franchiseSearch?.length > 0) {
    for (const franchise of parsed.franchiseSearch) {
      const lower = franchise.toLowerCase();
      if (gameName.includes(lower)) {
        totalScore += 2.5; // Strongest boost -- user wants THIS franchise
      }
    }
    totalChecks++;
  }

  // Mechanics match: alias-aware matching bridges BGG naming
  // ("Deck Building" -> "Deck, Bag, and Pool Building")
  if (parsed.mechanics.length > 0) {
    let mechanicHits = 0;
    for (const mech of parsed.mechanics) {
      if (gameMechanics.some((gm) => mechanicMatches(mech, gm))) {
        mechanicHits++;
      }
    }
    const mechanicRatio = mechanicHits / parsed.mechanics.length;
    // Single-mechanic queries ("deck building game") = the mechanic IS the query,
    // so use a stronger multiplier to differentiate true deck builders from games
    // that merely mention deck building somewhere in metadata
    const mechanicMultiplier = parsed.mechanics.length === 1 ? 1.5 : 1.2;
    totalScore += mechanicRatio * mechanicMultiplier;
    // Bonus for full mechanic match on single-mechanic queries
    if (mechanicRatio === 1.0 && parsed.mechanics.length === 1) totalScore += 0.3;
    if (mechanicRatio === 0) totalScore -= 0.3; // Penalty for zero match
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

  // Intent modifiers: apply bonuses/penalties based on priority signals
  if (parsed.intentModifiers) {
    const { mustHave, niceToHave, avoid, emphasize } = parsed.intentModifiers;

    // mustHave: strong bonus for matching, strong penalty for missing
    for (const term of mustHave ?? []) {
      const lower = term.toLowerCase();
      const found = allTags.some((t) => t.includes(lower) || lower.includes(t))
        || gameName.includes(lower) || gameDesc.includes(lower);
      totalScore += found ? 0.3 : -0.2;
      totalChecks++;
    }

    // avoid: penalty for matching
    for (const term of avoid ?? []) {
      const lower = term.toLowerCase();
      const found = allTags.some((t) => t.includes(lower) || lower.includes(t))
        || gameName.includes(lower) || gameDesc.includes(lower);
      if (found) totalScore -= 0.25;
    }

    // emphasize: mild bonus for matching
    for (const term of emphasize ?? []) {
      const lower = term.toLowerCase();
      const found = allTags.some((t) => t.includes(lower) || lower.includes(t))
        || gameDesc.includes(lower);
      if (found) totalScore += 0.15;
    }

    // niceToHave: small bonus for matching (no penalty for missing)
    for (const term of niceToHave ?? []) {
      const lower = term.toLowerCase();
      const found = allTags.some((t) => t.includes(lower) || lower.includes(t))
        || gameDesc.includes(lower);
      if (found) totalScore += 0.1;
    }
  }

  // Similar-to: "like Catan but better" wants ALTERNATIVES, not Catan itself.
  // The penalty must be strong enough to overcome genre/mechanic/keyword boosts
  // that the referenced game naturally accumulates (it matches its own genres).
  if (parsed.similarTo?.length > 0) {
    for (const similar of parsed.similarTo) {
      const lower = similar.toLowerCase();
      if (gameName.includes(lower) || lower.includes(gameName)) {
        totalScore -= 2.0; // Strong penalty -- user explicitly wants something ELSE
      }
    }
  }

  // Safety: if a term appears in both franchiseSearch AND similarTo (LLM confusion),
  // the franchise intent should win -- undo the similarTo penalty
  if (parsed.franchiseSearch?.length > 0 && parsed.similarTo?.length > 0) {
    for (const franchise of parsed.franchiseSearch) {
      const fl = franchise.toLowerCase();
      if (parsed.similarTo.some((s) => s.toLowerCase() === fl)
        && (gameName.includes(fl) || fl.includes(gameName))) {
        totalScore += 2.0; // Undo the similarTo penalty
      }
    }
  }

  if (totalChecks === 0) return 0.5;
  return Math.max(0, Math.min(totalScore / totalChecks, 1.0));
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
 * Quality signal: Bayesian-adjusted rating normalized to 0-1.
 *
 * Raw rating/10 is unreliable for games with few votes. A game rated
 * 9.5 by 12 people is less trustworthy than one rated 7.6 by 50,000.
 * We use a Bayesian average (IMDB-style) that pulls low-vote ratings
 * toward the global mean:
 *
 *   adjusted = (votes * rating + C * globalMean) / (votes + C)
 *
 * where C = minimum votes for full confidence (1000).
 * This means a game needs ~1000 ratings before its score is fully
 * trusted; below that, it's dampened toward 6.5/10.
 */
function scoreQuality(game: Game, isHiddenGems = false): number {
  // Use BGG's own Bayesian average if available (already dampened toward global mean)
  if (game.bayesAvgRating) return game.bayesAvgRating / 10;
  if (game.rating == null) return 0.3;

  // Hidden gems: use a much lower confidence threshold so niche games
  // with fewer votes can shine. A game rated 8.5 by 50 people should
  // score near 8.5, not get dragged to the 6.5 global mean.
  const GLOBAL_MEAN = 6.5;
  const votes = game.ratingCount ?? 0;

  // For hidden gems, trust ratings earlier (100 votes). For normal mode,
  // use raw rating once a game has at least 20 votes (avoids 12-vote flukes
  // while not crushing legitimate quality signals at 50-200 votes).
  const threshold = isHiddenGems ? 100 : 500;
  const bayesian = (votes * game.rating + threshold * GLOBAL_MEAN)
    / (votes + threshold);

  return bayesian / 10;
}

/**
 * Popularity signal: combines rating count, BGG rank, and ownership
 * into a single 0-1 score with meaningful spread.
 *
 * Previous version: bonuses stacked so almost every candidate hit 1.0,
 * making the 20% popularity weight useless for differentiation.
 *
 * New approach: three sub-signals averaged (each 0-1), producing a
 * smooth gradient where BGG top-50 games score ~0.95, top-500 ~0.75,
 * top-2000 ~0.55, and unranked obscure games ~0.15.
 */
function scorePopularity(game: Game): number {
  // Sub-signal 1: Rating count (log-scaled, 0-1)
  // 10->0.2, 100->0.4, 1k->0.6, 10k->0.8, 100k->1.0
  const count = game.ratingCount ?? 0;
  const countScore = count === 0 ? 0 : Math.min(Math.log10(count) / 5, 1.0);

  // Sub-signal 2: BGG rank (inverse log-scaled, 0-1)
  // Rank 1->1.0, 10->0.9, 100->0.75, 500->0.6, 1000->0.5, 5000->0.3, unranked->0.1
  const rank = game.rankOverall;
  let rankScore = 0.1; // unranked
  if (rank && rank > 0) {
    // log10(1)=0 -> 1.0, log10(100)=2 -> 0.75, log10(1000)=3 -> 0.625, log10(10000)=4 -> 0.5
    rankScore = Math.max(0.1, 1.0 - Math.log10(rank) * 0.125);
  }

  // Sub-signal 3: Ownership (log-scaled, 0-1)
  // 100->0.2, 1k->0.4, 10k->0.6, 50k->0.8, 100k+->1.0
  const owned = game.numOwned ?? 0;
  const ownScore = owned === 0 ? 0 : Math.min(Math.log10(owned) / 5, 1.0);

  // Weighted average: rank matters most (it's BGG's own quality+popularity signal)
  return rankScore * 0.5 + countScore * 0.3 + ownScore * 0.2;
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

  // Genre match (lowered threshold from 0.6 to 0.4 so more games get specific reasons)
  if (breakdown.genreMatch >= 0.4 && prefs.genres.length > 0) {
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
  if (breakdown.freeTextMatch >= 0.3 && prefs.freeText && prefs.freeText.trim()) {
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

  // BGG rank -- a strong trust signal
  if (game.rankOverall && game.rankOverall > 0 && game.rankOverall <= 100) {
    reasons.push(`A modern classic -- BGG rank #${game.rankOverall}`);
  } else if (game.rankOverall && game.rankOverall > 100 && game.rankOverall <= 500) {
    reasons.push(`Highly regarded -- BGG top 500`);
  }

  // Hidden gem signal
  if (game.rating && game.rating >= 7.5 && (game.ratingCount ?? 0) < 2000 && (game.ratingCount ?? 0) >= 20) {
    reasons.push(`A hidden gem -- loved by those who've played it`);
  }

  // Designer signal
  if (game.designers?.length && game.designers[0] && game.rating && game.rating >= 7.0) {
    reasons.push(`From designer ${game.designers[0]}`);
  }

  // Recency
  if (breakdown.recencyBoost >= 0.85 && game.yearPublished) {
    const currentYear = new Date().getFullYear();
    if (game.yearPublished >= currentYear) {
      reasons.push(`Brand new -- released in ${game.yearPublished}`);
    } else if (game.yearPublished >= currentYear - 1) {
      reasons.push(`Recently released (${game.yearPublished})`);
    }
  }

  // Fallback: mention a category or mechanic even if below scoring threshold
  if (reasons.length === 0) {
    if (game.mechanics.length > 0) {
      reasons.push(`Features ${game.mechanics[0]}`);
    } else if (game.categories.length > 0) {
      reasons.push(`A ${game.categories[0]} game`);
    } else if (game.rating && game.rating >= 7.0) {
      reasons.push(`Highly rated at ${game.rating.toFixed(1)}/10`);
    } else {
      reasons.push('Matches your overall preferences');
    }
  }

  return reasons.slice(0, 3); // Max 3 reasons
}
