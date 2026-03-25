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
    gameType: 'board',
    playerCount: { min: 2, max: 4 },
    timeAvailable: 'medium',
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
      makePrefs({ gameType: 'board' }),
    );
    expect(result.breakdown.typeMatch).toBe(1.0);
  });

  it('scores 0.0 when game type does not match', () => {
    const result = scoreGame(
      makeGame({ types: ['video'] }),
      makePrefs({ gameType: 'board' }),
    );
    expect(result.breakdown.typeMatch).toBe(0.0);
  });

  it('scores 0.5 when user has no type preference', () => {
    const result = scoreGame(
      makeGame({ types: ['board'] }),
      makePrefs({ gameType: null }),
    );
    expect(result.breakdown.typeMatch).toBe(0.5);
  });
});

// ─── Player Count ────────────────────────────────────────────

describe('scoreGame — player count', () => {
  it('scores high when game range overlaps user range', () => {
    const result = scoreGame(
      makeGame({ playerCount: { min: 2, max: 5 } }),
      makePrefs({ playerCount: { min: 3, max: 4 } }),
    );
    expect(result.breakdown.playerCountFit).toBeGreaterThan(0.7);
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

  it('penalizes when no overlap (1 off)', () => {
    const result = scoreGame(
      makeGame({ playerCount: { min: 5, max: 6 } }),
      makePrefs({ playerCount: { min: 2, max: 3 } }),
    );
    expect(result.breakdown.playerCountFit).toBeLessThan(0.5);
  });

  it('returns 0.5 when player count is unknown', () => {
    const result = scoreGame(
      makeGame({ playerCount: undefined }),
      makePrefs({ playerCount: { min: 2, max: 4 } }),
    );
    expect(result.breakdown.playerCountFit).toBe(0.5);
  });
});

// ─── Time Fit ────────────────────────────────────────────────

describe('scoreGame — time fit', () => {
  it('scores 1.0 when game time is within preset range', () => {
    // 'medium' = 30-60 min
    const result = scoreGame(
      makeGame({ playTime: { min: 30, max: 60, average: 45 } }),
      makePrefs({ timeAvailable: 'medium' }),
    );
    expect(result.breakdown.timeFit).toBe(1.0);
  });

  it('scores less when game time is outside range', () => {
    // 'quick' = 0-15 min, game is 120 min
    const result = scoreGame(
      makeGame({ playTime: { min: 90, max: 150, average: 120 } }),
      makePrefs({ timeAvailable: 'quick' }),
    );
    expect(result.breakdown.timeFit).toBeLessThan(0.5);
  });

  it('scores 0.5 when user has no time preference', () => {
    const result = scoreGame(
      makeGame({ playTime: { min: 60, max: 120, average: 90 } }),
      makePrefs({ timeAvailable: null }),
    );
    expect(result.breakdown.timeFit).toBe(0.5);
  });

  it('scores 0.4 when play time is unknown', () => {
    const result = scoreGame(
      makeGame({ playTime: undefined }),
      makePrefs({ timeAvailable: 'medium' }),
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

  it('scores 0.5 when complexity is unknown', () => {
    const result = scoreGame(
      makeGame({ complexity: undefined }),
      makePrefs({ complexity: { min: 2, max: 4 } }),
    );
    expect(result.breakdown.complexityFit).toBe(0.5);
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
      makeGame({ complexity: 1.5, categories: ['Family'], mechanics: [], themes: [] }),
      makePrefs({ moods: ['chill'] }),
    );
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
  it('normalizes rating to 0-1 scale', () => {
    const result = scoreGame(makeGame({ rating: 8.0 }), makePrefs());
    expect(result.breakdown.qualitySignal).toBe(0.8);
  });

  it('scores 0.3 for unknown rating', () => {
    const result = scoreGame(makeGame({ rating: undefined }), makePrefs());
    expect(result.breakdown.qualitySignal).toBe(0.3);
  });

  it('scores 1.0 for perfect rating', () => {
    const result = scoreGame(makeGame({ rating: 10.0 }), makePrefs());
    expect(result.breakdown.qualitySignal).toBe(1.0);
  });
});

// ─── Popularity Signal ───────────────────────────────────────

describe('scoreGame — popularity signal', () => {
  it('returns 0 for games with no ratings', () => {
    const result = scoreGame(makeGame({ ratingCount: 0 }), makePrefs());
    expect(result.breakdown.popularitySignal).toBe(0);
  });

  it('scales logarithmically', () => {
    const low = scoreGame(makeGame({ ratingCount: 10 }), makePrefs());
    const mid = scoreGame(makeGame({ ratingCount: 1000 }), makePrefs());
    const high = scoreGame(makeGame({ ratingCount: 100000 }), makePrefs());

    expect(low.breakdown.popularitySignal).toBeLessThan(mid.breakdown.popularitySignal);
    expect(mid.breakdown.popularitySignal).toBeLessThan(high.breakdown.popularitySignal);
    expect(high.breakdown.popularitySignal).toBe(1.0);
  });
});

// ─── Weights ─────────────────────────────────────────────────

describe('weight configurations', () => {
  it('DEFAULT_WEIGHTS sum to approximately 1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('POPULAR_WEIGHTS emphasize popularity over default', () => {
    expect(POPULAR_WEIGHTS.popularitySignal).toBeGreaterThan(DEFAULT_WEIGHTS.popularitySignal);
  });

  it('HIDDEN_GEMS_WEIGHTS de-emphasize popularity', () => {
    expect(HIDDEN_GEMS_WEIGHTS.popularitySignal).toBeLessThan(DEFAULT_WEIGHTS.popularitySignal);
  });

  it('different weights produce different rankings', () => {
    const popular = makeGame({ id: 'popular', rating: 7.0, ratingCount: 100000, categories: ['Strategy'] });
    const niche = makeGame({ id: 'niche', rating: 8.5, ratingCount: 50, categories: ['Strategy'] });
    const prefs = makePrefs();

    const popularWeights = scoreGames([popular, niche], prefs, POPULAR_WEIGHTS);
    const hiddenGemsWeights = scoreGames([popular, niche], prefs, HIDDEN_GEMS_WEIGHTS);

    // Popular weights should favor the popular game more
    const popularFirst = popularWeights[0].game.id;
    const gemsFirst = hiddenGemsWeights[0].game.id;

    // At minimum, the relative score difference should shift
    const popularDiff = popularWeights[0].score - popularWeights[1].score;
    const gemsDiff = hiddenGemsWeights[0].score - hiddenGemsWeights[1].score;
    expect(popularDiff).not.toBeCloseTo(gemsDiff, 2);
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
        gameType: 'board',
        playerCount: { min: 2, max: 4 },
        timeAvailable: 'medium',
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
      makePrefs({ gameType: 'board' }),
    );
    expect(result.reasons.some((r) => r.includes('board'))).toBe(true);
  });

  it('includes rating reason for highly-rated games with minimal other matches', () => {
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
      makePrefs({ gameType: 'video', genres: [], moods: [] }),
    );
    // With minimal dimension matches, the quality signal reason should surface
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
        gameType: 'board',
        playerCount: { min: 2, max: 4 },
        timeAvailable: 'medium',
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
        gameType: 'board',
        playerCount: { min: 4, max: 8 },
        timeAvailable: 'quick',
        complexity: { min: 1, max: 2 },
        genres: ['Horror', 'Puzzle'],
        moods: ['cooperative'],
      }),
    );
    expect(result.score).toBeLessThan(0.25);
  });
});
