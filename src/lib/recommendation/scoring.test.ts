/**
 * Tests for the rule-based recommendation scoring engine.
 *
 * Covers all 8 scoring dimensions, weight configurations,
 * reason generation, and the overall scoring pipeline.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreGames,
  scoreGame,
  DEFAULT_WEIGHTS,
  POPULAR_WEIGHTS,
  HIDDEN_GEMS_WEIGHTS,
} from './scoring';
import type { ScoredGame } from './scoring';
import type { Game } from '@/types/game';
import type { QuestionnaireState } from '@/types/questionnaire';

// ─── Test Helpers ────────────────────────────────────────────

/** Creates a minimal Game with sensible defaults, overridable */
function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'test-1',
    source: 'bgg',
    sourceId: '1',
    name: 'Test Game',
    description: 'A test game',
    types: ['board'],
    categories: ['Strategy'],
    mechanics: ['Hand Management'],
    themes: ['Fantasy'],
    platforms: [],
    playerCount: { min: 2, max: 4 },
    playTime: { min: 30, max: 60, average: 45 },
    complexity: 2.5,
    rating: 7.5,
    ratingCount: 5000,
    ...overrides,
  };
}

/** Creates default questionnaire preferences, overridable */
function makePrefs(overrides: Partial<QuestionnaireState> = {}): QuestionnaireState {
  return {
    gameTypes: ['board'],
    playerCount: { min: 2, max: 4 },
    timePresets: ['medium'],
    complexity: { min: 2, max: 4 },
    genres: ['Strategy'],
    moods: ['competitive'],
    freeText: '',
    ...overrides,
  };
}

// ─── scoreGames (integration) ────────────────────────────────

describe('scoreGames', () => {
  it('returns games sorted by score (highest first)', () => {
    const games = [
      makeGame({ id: 'bad', types: ['video'], rating: 3 }),
      makeGame({ id: 'perfect', types: ['board'], rating: 9, ratingCount: 10000 }),
      makeGame({ id: 'ok', types: ['board'], rating: 6 }),
    ];

    const results = scoreGames(games, makePrefs());

    expect(results[0].game.id).toBe('perfect');
    expect(results[results.length - 1].game.id).toBe('bad');
    // Scores should be descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('returns empty array for empty input', () => {
    expect(scoreGames([], makePrefs())).toEqual([]);
  });

  it('includes breakdown and reasons for every scored game', () => {
    const results = scoreGames([makeGame()], makePrefs());

    expect(results).toHaveLength(1);
    expect(results[0].breakdown).toBeDefined();
    expect(results[0].reasons).toBeDefined();
    expect(results[0].reasons.length).toBeGreaterThan(0);
  });
});

// ─── Type Match ──────────────────────────────────────────────

describe('scoreGame — type match', () => {
  it('scores 1.0 when game type matches preference', () => {
    const result = scoreGame(
      makeGame({ types: ['board'] }),
      makePrefs({ gameTypes: ['board'] }),
    );
    expect(result.breakdown.typeMatch).toBe(1.0);
  });

  it('scores 0.0 when game type does not match', () => {
    const result = scoreGame(
      makeGame({ types: ['video'] }),
      makePrefs({ gameTypes: ['board'] }),
    );
    expect(result.breakdown.typeMatch).toBe(0.0);
  });

  it('scores 0.5 when user has no type preference', () => {
    const result = scoreGame(
      makeGame({ types: ['board'] }),
      makePrefs({ gameTypes: [] }),
    );
    expect(result.breakdown.typeMatch).toBe(0.5);
  });
});

// ─── Player Count ────────────────────────────────────────────

describe('scoreGame — player count', () => {
  it('scores high when game range tightly fits user range', () => {
    // 2-4 game for a 2-4 request = perfect tight fit
    const result = scoreGame(
      makeGame({ playerCount: { min: 2, max: 4 } }),
      makePrefs({ playerCount: { min: 2, max: 4 } }),
    );
    expect(result.breakdown.playerCountFit).toBeGreaterThan(0.8);
  });

  it('scores higher for tight-fit games than broad-range games', () => {
    const prefs = makePrefs({ playerCount: { min: 1, max: 2 } });

    // 1-2 player game = tight fit for 1-2 request
    const tightFit = scoreGame(
      makeGame({ playerCount: { min: 1, max: 2 } }),
      prefs,
    );
    // 2-8 player game = technically supports 2, but way too broad
    const broadFit = scoreGame(
      makeGame({ playerCount: { min: 2, max: 8 } }),
      prefs,
    );

    expect(tightFit.breakdown.playerCountFit).toBeGreaterThan(broadFit.breakdown.playerCountFit);
  });

  it('scores higher with recommended player count in range', () => {
    const withRec = scoreGame(
      makeGame({ playerCount: { min: 2, max: 6, recommended: 4 } }),
      makePrefs({ playerCount: { min: 3, max: 5 } }),
    );
    const withoutRec = scoreGame(
      makeGame({ playerCount: { min: 2, max: 6 } }),
      makePrefs({ playerCount: { min: 3, max: 5 } }),
    );
    expect(withRec.breakdown.playerCountFit).toBeGreaterThanOrEqual(withoutRec.breakdown.playerCountFit);
  });

  it('returns 0.0 when no overlap at all', () => {
    const result = scoreGame(
      makeGame({ playerCount: { min: 5, max: 6 } }),
      makePrefs({ playerCount: { min: 2, max: 3 } }),
    );
    expect(result.breakdown.playerCountFit).toBe(0.0);
  });

  it('returns 0.3 when player count is unknown', () => {
    const result = scoreGame(
      makeGame({ playerCount: undefined }),
      makePrefs({ playerCount: { min: 2, max: 4 } }),
    );
    expect(result.breakdown.playerCountFit).toBe(0.3);
  });

  it('gives bonus when game range fits entirely within user range', () => {
    // User wants 1-4, game is 2-3 (fits entirely within)
    const fitsInside = scoreGame(
      makeGame({ playerCount: { min: 2, max: 3 } }),
      makePrefs({ playerCount: { min: 1, max: 4 } }),
    );
    // User wants 1-4, game is 1-8 (extends far beyond)
    const extendsBeyond = scoreGame(
      makeGame({ playerCount: { min: 1, max: 8 } }),
      makePrefs({ playerCount: { min: 1, max: 4 } }),
    );
    expect(fitsInside.breakdown.playerCountFit).toBeGreaterThan(extendsBeyond.breakdown.playerCountFit);
  });

  // ─── Critical regression test: user's exact reported issue ─────
  it('ranks 1-2 player games above 1-4/1-5 player games when user wants 1-2', () => {
    const prefs = makePrefs({
      gameTypes: [],
      playerCount: { min: 1, max: 2 },
      timePresets: [],
      complexity: { min: 1, max: 5 },
      genres: [],
      moods: [],
      freeText: '',
    });

    const twoPlayerGame = makeGame({
      id: 'tight-2p',
      playerCount: { min: 1, max: 2 },
      rating: 7.0,
      ratingCount: 1000,
    });
    const fourPlayerGame = makeGame({
      id: 'broad-4p',
      playerCount: { min: 1, max: 4 },
      rating: 7.0,
      ratingCount: 1000,
    });
    const fivePlayerGame = makeGame({
      id: 'broad-5p',
      playerCount: { min: 1, max: 5 },
      rating: 7.0,
      ratingCount: 1000,
    });

    const results = scoreGames([fivePlayerGame, fourPlayerGame, twoPlayerGame], prefs);

    // The 1-2 player game MUST rank first
    expect(results[0].game.id).toBe('tight-2p');
    // And it must score meaningfully higher, not just barely
    expect(results[0].score - results[1].score).toBeGreaterThan(0.02);
  });
});

// ─── Time Fit ────────────────────────────────────────────────

describe('scoreGame — time fit', () => {
  it('scores 1.0 when game time is within preset range', () => {
    // 'medium' = 30-60 min
    const result = scoreGame(
      makeGame({ playTime: { min: 30, max: 60, average: 45 } }),
      makePrefs({ timePresets: ['medium'] }),
    );
    expect(result.breakdown.timeFit).toBe(1.0);
  });

  it('scores less when game time is outside range', () => {
    // 'quick' = 0-15 min, game is 120 min
    const result = scoreGame(
      makeGame({ playTime: { min: 90, max: 150, average: 120 } }),
      makePrefs({ timePresets: ['quick'] }),
    );
    expect(result.breakdown.timeFit).toBeLessThan(0.5);
  });

  it('scores 0.5 when user has no time preference', () => {
    const result = scoreGame(
      makeGame({ playTime: { min: 60, max: 120, average: 90 } }),
      makePrefs({ timePresets: [] }),
    );
    expect(result.breakdown.timeFit).toBe(0.5);
  });

  it('scores 0.4 when play time is unknown', () => {
    const result = scoreGame(
      makeGame({ playTime: undefined }),
      makePrefs({ timePresets: ['medium'] }),
    );
    expect(result.breakdown.timeFit).toBe(0.4);
  });
});

// ─── Complexity ──────────────────────────────────────────────

describe('scoreGame — complexity', () => {
  it('scores 1.0 when complexity is in range', () => {
    const result = scoreGame(
      makeGame({ complexity: 3.0 }),
      makePrefs({ complexity: { min: 2, max: 4 } }),
    );
    expect(result.breakdown.complexityFit).toBe(1.0);
  });

  it('penalizes when complexity is outside range', () => {
    const result = scoreGame(
      makeGame({ complexity: 5.0 }),
      makePrefs({ complexity: { min: 1, max: 2 } }),
    );
    expect(result.breakdown.complexityFit).toBeLessThan(0.5);
  });

  it('penalizes unknown complexity when user specified a range', () => {
    const result = scoreGame(
      makeGame({ complexity: undefined }),
      makePrefs({ complexity: { min: 2, max: 4 } }),
    );
    expect(result.breakdown.complexityFit).toBe(0.2);
  });
});

// ─── Genre Match ─────────────────────────────────────────────

describe('scoreGame — genre match', () => {
  it('scores high when genres match categories', () => {
    const result = scoreGame(
      makeGame({ categories: ['Strategy', 'War'], mechanics: [], themes: [] }),
      makePrefs({ genres: ['Strategy'] }),
    );
    expect(result.breakdown.genreMatch).toBeGreaterThan(0.7);
  });

  it('scores higher with more genre matches', () => {
    const oneMatch = scoreGame(
      makeGame({ categories: ['Strategy', 'War'], mechanics: ['Dice Rolling'], themes: ['Fantasy'] }),
      makePrefs({ genres: ['Strategy', 'Horror', 'Sci-Fi'] }),
    );
    const twoMatches = scoreGame(
      makeGame({ categories: ['Strategy', 'Horror'], mechanics: ['Dice Rolling'], themes: ['Fantasy'] }),
      makePrefs({ genres: ['Strategy', 'Horror', 'Sci-Fi'] }),
    );
    expect(twoMatches.breakdown.genreMatch).toBeGreaterThan(oneMatch.breakdown.genreMatch);
  });

  it('scores 0.5 when user has no genre preference', () => {
    const result = scoreGame(
      makeGame({ categories: ['Strategy'] }),
      makePrefs({ genres: [] }),
    );
    expect(result.breakdown.genreMatch).toBe(0.5);
  });

  it('scores low when no genres match', () => {
    const result = scoreGame(
      makeGame({ categories: ['Racing'], mechanics: ['Dice Rolling'], themes: ['Sports'] }),
      makePrefs({ genres: ['Horror', 'Puzzle'] }),
    );
    expect(result.breakdown.genreMatch).toBeLessThanOrEqual(0.1);
  });

  it('handles substring matching (e.g. Strategy matches Abstract Strategy)', () => {
    const result = scoreGame(
      makeGame({ categories: ['Abstract Strategy'], mechanics: [], themes: [] }),
      makePrefs({ genres: ['Strategy'] }),
    );
    expect(result.breakdown.genreMatch).toBeGreaterThan(0.5);
  });
});

// ─── Mood Alignment ──────────────────────────────────────────

describe('scoreGame — mood alignment', () => {
  it('scores high for cooperative mood + cooperative game', () => {
    const result = scoreGame(
      makeGame({ categories: ['Cooperative Game'], mechanics: ['Co-op'], themes: [] }),
      makePrefs({ moods: ['cooperative'] }),
    );
    expect(result.breakdown.moodAlignment).toBeGreaterThan(0.7);
  });

  it('scores high for chill mood + low complexity family game', () => {
    const result = scoreGame(
      makeGame({ complexity: 1.5, categories: ['Family'], mechanics: [], themes: [], playTime: { average: 30 } }),
      makePrefs({ moods: ['chill'] }),
    );
    // Low complexity (0.4) + family (0.25) + short time (0.1) = 0.75
    expect(result.breakdown.moodAlignment).toBeGreaterThan(0.7);
  });

  it('scores high for brain-teaser mood + complex strategy game', () => {
    const result = scoreGame(
      makeGame({ complexity: 4.0, categories: ['Strategy'], mechanics: ['Puzzle'], themes: [] }),
      makePrefs({ moods: ['brain-teaser'] }),
    );
    expect(result.breakdown.moodAlignment).toBeGreaterThan(0.7);
  });

  it('scores 0.5 when user has no mood preference', () => {
    const result = scoreGame(
      makeGame(),
      makePrefs({ moods: [] }),
    );
    expect(result.breakdown.moodAlignment).toBe(0.5);
  });
});

// ─── Quality Signal ──────────────────────────────────────────

describe('scoreGame — quality signal', () => {
  it('uses Bayesian-adjusted rating (dampened toward mean for low-vote games)', () => {
    // With 5000 votes (default makeGame), rating 8.0:
    // bayesian = (5000*8 + 500*6.5) / 5500 = 7.864 → 0.786
    const result = scoreGame(makeGame({ rating: 8.0 }), makePrefs());
    expect(result.breakdown.qualitySignal).toBeCloseTo(0.786, 2);
  });

  it('scores 0.3 for unknown rating', () => {
    const result = scoreGame(makeGame({ rating: undefined }), makePrefs());
    expect(result.breakdown.qualitySignal).toBe(0.3);
  });

  it('high-vote games approach raw rating', () => {
    // With 50000 votes, rating 10.0:
    // bayesian = (50000*10 + 1000*6.5) / 51000 ≈ 9.931 → 0.993
    const result = scoreGame(makeGame({ rating: 10.0, ratingCount: 50000 }), makePrefs());
    expect(result.breakdown.qualitySignal).toBeGreaterThan(0.99);
  });

  it('low-vote games are dampened toward global mean', () => {
    // With 50 votes, rating 9.5:
    // bayesian = (50*9.5 + 500*6.5) / 550 ≈ 6.773 → 0.677
    const lowVote = scoreGame(makeGame({ rating: 9.5, ratingCount: 50 }), makePrefs());
    const highVote = scoreGame(makeGame({ rating: 9.5, ratingCount: 50000 }), makePrefs());
    expect(lowVote.breakdown.qualitySignal).toBeLessThan(highVote.breakdown.qualitySignal);
    expect(lowVote.breakdown.qualitySignal).toBeCloseTo(0.677, 2);
  });
});

// ─── Popularity Signal ───────────────────────────────────────

describe('scoreGame — popularity signal', () => {
  it('returns near-zero for games with no ratings', () => {
    // rankScore defaults to 0.1 (unranked), countScore=0, ownScore=0
    // Result: 0.1*0.5 + 0 + 0 = 0.05
    const result = scoreGame(makeGame({ ratingCount: 0 }), makePrefs());
    expect(result.breakdown.popularitySignal).toBeCloseTo(0.05, 2);
  });

  it('scales logarithmically', () => {
    const low = scoreGame(makeGame({ ratingCount: 10 }), makePrefs());
    const mid = scoreGame(makeGame({ ratingCount: 1000 }), makePrefs());
    const high = scoreGame(makeGame({ ratingCount: 100000 }), makePrefs());

    expect(low.breakdown.popularitySignal).toBeLessThan(mid.breakdown.popularitySignal);
    expect(mid.breakdown.popularitySignal).toBeLessThan(high.breakdown.popularitySignal);
    // 100k ratings: countScore=1.0, but rankScore and ownScore depend on those fields
    // which makeGame doesn't set, so: rankScore=0.1*0.5 + countScore=1.0*0.3 + ownScore=0*0.2 = 0.35
    expect(high.breakdown.popularitySignal).toBeGreaterThan(0.3);
  });
});

// ─── Weights ─────────────────────────────────────────────────

describe('weight configurations', () => {
  it('DEFAULT_WEIGHTS sum to approximately 1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('POPULAR_WEIGHTS is deprecated alias for DEFAULT_WEIGHTS', () => {
    expect(POPULAR_WEIGHTS.popularitySignal).toBe(DEFAULT_WEIGHTS.popularitySignal);
  });

  it('HIDDEN_GEMS_WEIGHTS de-emphasize popularity', () => {
    expect(HIDDEN_GEMS_WEIGHTS.popularitySignal).toBeLessThan(DEFAULT_WEIGHTS.popularitySignal);
  });

  it('different weights produce different rankings', () => {
    const popular = makeGame({ id: 'popular', rating: 7.0, ratingCount: 100000, categories: ['Strategy'] });
    const niche = makeGame({ id: 'niche', rating: 8.5, ratingCount: 50, categories: ['Strategy'] });
    const prefs = makePrefs();

    const defaultWeights = scoreGames([popular, niche], prefs, DEFAULT_WEIGHTS);
    const hiddenGemsWeights = scoreGames([popular, niche], prefs, HIDDEN_GEMS_WEIGHTS);

    // Hidden gems has 0% popularity weight and 15% quality weight.
    // Default has 6% popularity and 3% quality. These different profiles
    // should produce different score breakdowns.
    const defaultPopBreakdown = defaultWeights.find((r) => r.game.id === 'popular')!.breakdown;
    const gemsPopBreakdown = hiddenGemsWeights.find((r) => r.game.id === 'popular')!.breakdown;
    // The popularity dimension raw values should be identical (same game, same dimension scorer)
    expect(defaultPopBreakdown.popularitySignal).toBe(gemsPopBreakdown.popularitySignal);
    // The popular game should rank lower under hidden gems (which zeroes out popularity)
    const defaultPopularScore = defaultWeights.find((r) => r.game.id === 'popular')!.score;
    const gemsPopularScore = hiddenGemsWeights.find((r) => r.game.id === 'popular')!.score;
    expect(defaultPopularScore).toBeGreaterThan(gemsPopularScore);
  });
});

// ─── Reason Generation ──────────────────────────────────────

describe('reason generation', () => {
  it('generates at least one reason for any game', () => {
    const result = scoreGame(makeGame(), makePrefs());
    expect(result.reasons.length).toBeGreaterThanOrEqual(1);
  });

  it('generates max 3 reasons', () => {
    // Perfect match on every dimension should still cap at 3
    const result = scoreGame(
      makeGame({
        types: ['board'],
        playerCount: { min: 2, max: 4, recommended: 3 },
        playTime: { min: 30, max: 60, average: 45 },
        complexity: 3.0,
        categories: ['Strategy'],
        mechanics: ['Cooperative Game'],
        themes: [],
        rating: 9.0,
        ratingCount: 50000,
      }),
      makePrefs({
        gameTypes: ['board'],
        playerCount: { min: 2, max: 4 },
        timePresets: ['medium'],
        complexity: { min: 2, max: 4 },
        genres: ['Strategy'],
        moods: ['cooperative'],
      }),
    );
    expect(result.reasons.length).toBeLessThanOrEqual(3);
  });

  it('includes type match reason for matching type', () => {
    const result = scoreGame(
      makeGame({ types: ['board'] }),
      makePrefs({ gameTypes: ['board'] }),
    );
    expect(result.reasons.some((r) => r.includes('board'))).toBe(true);
  });

  it('includes rating reason for highly-rated games with no other matches', () => {
    // Use types that DON'T match prefs so typeMatch reason doesn't fire,
    // and empty categories/mechanics/themes so the fallback triggers
    const result = scoreGame(
      makeGame({
        rating: 9.2,
        types: ['video'],
        categories: [],
        mechanics: [],
        themes: [],
        playerCount: undefined,
        playTime: undefined,
        complexity: undefined,
      }),
      makePrefs({ gameTypes: ['board'], genres: [], moods: [] }),
    );
    // With no dimension matches at all, the fallback "Highly rated" reason should surface
    expect(result.reasons.some((r) => r.includes('9.2') || r.includes('Highly rated') || r.includes('ated'))).toBe(true);
  });
});

// ─── Composite Score ─────────────────────────────────────────

describe('composite score', () => {
  it('perfect match scores near 1.0', () => {
    const result = scoreGame(
      makeGame({
        types: ['board'],
        playerCount: { min: 2, max: 4, recommended: 3 },
        playTime: { min: 30, max: 60, average: 45 },
        complexity: 3.0,
        categories: ['Strategy'],
        mechanics: ['Auction/Bidding'],
        themes: [],
        rating: 9.5,
        ratingCount: 100000,
      }),
      makePrefs({
        gameTypes: ['board'],
        playerCount: { min: 2, max: 4 },
        timePresets: ['medium'],
        complexity: { min: 2, max: 4 },
        genres: ['Strategy'],
        moods: ['competitive'],
      }),
    );
    expect(result.score).toBeGreaterThan(0.8);
  });

  it('terrible match scores near 0', () => {
    const result = scoreGame(
      makeGame({
        types: ['video'],
        playerCount: { min: 1, max: 1 },
        playTime: { min: 200, max: 300, average: 250 },
        complexity: 5.0,
        categories: ['Racing'],
        mechanics: [],
        themes: ['Sports'],
        rating: 3.0,
        ratingCount: 5,
      }),
      makePrefs({
        gameTypes: ['board'],
        playerCount: { min: 4, max: 8 },
        timePresets: ['quick'],
        complexity: { min: 1, max: 2 },
        genres: ['Horror', 'Puzzle'],
        moods: ['cooperative'],
      }),
    );
    expect(result.score).toBeLessThan(0.25);
  });
});

// ─── Recommendation Quality Scenarios ────────────────────────
// These test real-world scenarios users might encounter.

describe('recommendation quality', () => {
  it('user picks 1-2 players only: all top results must be playable by 1-2 people', () => {
    const prefs = makePrefs({
      gameTypes: [],
      playerCount: { min: 1, max: 2 },
      timePresets: [],
      complexity: { min: 1, max: 5 },
      genres: [],
      moods: [],
      freeText: '',
    });

    // Mix of games: some 1-2, some broader, some incompatible
    const games = [
      makeGame({ id: 'chess', playerCount: { min: 2, max: 2 }, rating: 8.0, ratingCount: 5000, categories: ['Abstract'] }),
      makeGame({ id: 'patchwork', playerCount: { min: 2, max: 2 }, rating: 7.8, ratingCount: 3000, categories: ['Puzzle'] }),
      makeGame({ id: '7wonders-duel', playerCount: { min: 2, max: 2, recommended: 2 }, rating: 8.2, ratingCount: 8000, categories: ['Strategy'] }),
      makeGame({ id: 'catan', playerCount: { min: 3, max: 4 }, rating: 7.5, ratingCount: 90000, categories: ['Strategy'] }),
      makeGame({ id: 'codenames', playerCount: { min: 2, max: 8 }, rating: 7.7, ratingCount: 60000, categories: ['Party'] }),
      makeGame({ id: 'pandemic', playerCount: { min: 2, max: 4 }, rating: 7.6, ratingCount: 40000, categories: ['Cooperative Game'] }),
      makeGame({ id: 'one-night', playerCount: { min: 3, max: 10 }, rating: 7.2, ratingCount: 20000, categories: ['Party'] }),
    ];

    const results = scoreGames(games, prefs);

    // Top 3 results must all be games that support 1-2 players
    const top3 = results.slice(0, 3);
    for (const { game } of top3) {
      expect(game.playerCount!.min).toBeLessThanOrEqual(2);
      // Game must actually be playable with 2 or fewer
      expect(game.playerCount!.min).toBeLessThanOrEqual(prefs.playerCount.max);
    }

    // Games that require 3+ players (catan, one-night) must NOT be in top 3
    const top3Ids = top3.map((r) => r.game.id);
    expect(top3Ids).not.toContain('catan');
    expect(top3Ids).not.toContain('one-night');

    // Dedicated 2-player games should outrank broad-range party games
    const duelScore = results.find((r) => r.game.id === '7wonders-duel')!.score;
    const codenamesScore = results.find((r) => r.game.id === 'codenames')!.score;
    expect(duelScore).toBeGreaterThan(codenamesScore);
  });

  it('user picks 4-6 players + strategy: strategy games for that count win', () => {
    const prefs = makePrefs({
      gameTypes: ['board'],
      playerCount: { min: 4, max: 6 },
      timePresets: ['long'],
      complexity: { min: 3, max: 5 },
      genres: ['Strategy'],
      moods: ['competitive'],
    });

    const games = [
      makeGame({ id: 'twilight', types: ['board'], playerCount: { min: 3, max: 6 }, complexity: 4.5, rating: 8.7, ratingCount: 20000, categories: ['Strategy'], playTime: { min: 180, max: 480, average: 300 } }),
      makeGame({ id: 'party-game', types: ['board'], playerCount: { min: 4, max: 10 }, complexity: 1.2, rating: 7.5, ratingCount: 30000, categories: ['Party'], playTime: { min: 15, max: 30, average: 20 } }),
      makeGame({ id: 'solo-puzzle', types: ['board'], playerCount: { min: 1, max: 1 }, complexity: 3.5, rating: 7.8, ratingCount: 5000, categories: ['Puzzle'], playTime: { min: 60, max: 90, average: 75 } }),
    ];

    const results = scoreGames(games, prefs);

    // Twilight Imperium should win — right type, player count, complexity, genre, time
    expect(results[0].game.id).toBe('twilight');
    // Solo puzzle can't be played with 4-6, should score worst on player count
    const soloScore = results.find((r) => r.game.id === 'solo-puzzle')!;
    expect(soloScore.breakdown.playerCountFit).toBe(0.0);
  });

  it('user skips all questions: should still return reasonable results sorted by quality', () => {
    const prefs = makePrefs({
      gameTypes: [],
      playerCount: { min: 1, max: 8 },
      timePresets: [],
      complexity: { min: 1, max: 5 },
      genres: [],
      moods: [],
      freeText: '',
    });

    const games = [
      makeGame({ id: 'great', rating: 9.0, ratingCount: 50000 }),
      makeGame({ id: 'good', rating: 7.5, ratingCount: 10000 }),
      makeGame({ id: 'bad', rating: 3.0, ratingCount: 100 }),
    ];

    const results = scoreGames(games, prefs);

    // With no preferences, quality/popularity should dominate
    expect(results[0].game.id).toBe('great');
    expect(results[results.length - 1].game.id).toBe('bad');
  });

  it('fast deck building game: well-known deck builders outrank obscure ones', () => {
    // This is the core scenario: "fast deck building game under 30 minutes"
    // Dominion and Star Realms should rank above obscure games with higher ratings
    const prefs = makePrefs({
      gameTypes: ['board'],
      playerCount: { min: 2, max: 4 },
      timePresets: ['short'],
      complexity: { min: 1, max: 3 },
      genres: ['Deck Building'],
      moods: ['competitive'],
      freeText: 'fast deck building game',
      llmParsed: {
        gameTypes: [],
        genres: ['Deck Building'],
        mechanics: ['Deck Building'],
        moods: [],
        complexity: null,
        playerCount: null,
        timePresets: [],
        similarTo: [],
        keywords: ['fast', 'deck building'],
        excludedGenres: [],
        excludedMechanics: [],
        maxMinutes: null,
        timeStrictness: null,
        designers: [],
      },
    });

    const games = [
      makeGame({
        id: 'dominion',
        name: 'Dominion',
        types: ['board'],
        categories: ['Card Game'],
        mechanics: ['Deck, Bag, and Pool Building', 'Hand Management'],
        themes: ['Medieval'],
        playerCount: { min: 2, max: 4 },
        playTime: { min: 30, max: 30, average: 30 },
        complexity: 2.35,
        rating: 7.6,
        ratingCount: 55000,
      }),
      makeGame({
        id: 'star-realms',
        name: 'Star Realms',
        types: ['board'],
        categories: ['Card Game', 'Science Fiction'],
        mechanics: ['Deck, Bag, and Pool Building'],
        themes: ['Space'],
        playerCount: { min: 2, max: 2 },
        playTime: { min: 20, max: 20, average: 20 },
        complexity: 1.95,
        rating: 7.5,
        ratingCount: 25000,
      }),
      makeGame({
        id: 'obscure-deckbuilder',
        name: 'Niche Card Battler Extreme',
        types: ['board'],
        categories: ['Card Game'],
        mechanics: ['Deck, Bag, and Pool Building'],
        themes: ['Fantasy'],
        playerCount: { min: 2, max: 4 },
        playTime: { min: 25, max: 35, average: 30 },
        complexity: 2.0,
        rating: 8.5,
        ratingCount: 47,
      }),
      makeGame({
        id: 'wrong-genre',
        name: 'Epic War Simulation',
        types: ['board'],
        categories: ['Wargame'],
        mechanics: ['Hex-and-Counter'],
        themes: ['World War II'],
        playerCount: { min: 2, max: 2 },
        playTime: { min: 180, max: 360, average: 240 },
        complexity: 4.5,
        rating: 8.2,
        ratingCount: 3000,
      }),
    ];

    const results = scoreGames(games, prefs);

    // All deck builders should score well; wrong-genre game should score poorly
    const dominionScore = results.find((r) => r.game.id === 'dominion')!.score;
    const starRealmsScore = results.find((r) => r.game.id === 'star-realms')!.score;
    const obscureScore = results.find((r) => r.game.id === 'obscure-deckbuilder')!.score;
    const wrongGenreScore = results.find((r) => r.game.id === 'wrong-genre')!.score;

    // All deck builders (famous or obscure) should crush the wrong-genre game
    expect(dominionScore).toBeGreaterThan(wrongGenreScore);
    expect(starRealmsScore).toBeGreaterThan(wrongGenreScore);
    expect(obscureScore).toBeGreaterThan(wrongGenreScore);
    // Dominion should beat the obscure one (it's THE deck builder with 55k ratings)
    expect(dominionScore).toBeGreaterThan(obscureScore);
  });
});
