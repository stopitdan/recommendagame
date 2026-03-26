/**
 * Tests for the diversity re-ranking module.
 */

import { describe, it, expect } from 'vitest';
import { diversityRerank } from './diversity';
import type { ScoredGame } from './scoring';
import type { Game } from '@/types/game';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'test-1',
    source: 'bgg',
    sourceId: '1',
    name: 'Test Game',
    description: '',
    types: ['board'],
    categories: ['Strategy'],
    mechanics: ['Hand Management'],
    themes: ['Fantasy'],
    platforms: [],
    ...overrides,
  };
}

function makeScoredGame(id: string, score: number, categories: string[] = ['Strategy'], mechanics: string[] = []): ScoredGame {
  return {
    game: makeGame({ id, categories, mechanics }),
    score,
    reasons: [],
    breakdown: {
      typeMatch: 0, playerCountFit: 0, timeFit: 0, complexityFit: 0,
      genreMatch: 0, moodAlignment: 0, freeTextMatch: 0,
      qualitySignal: 0, popularitySignal: 0, recencyBoost: 0,
    },
  };
}

describe('diversityRerank', () => {
  it('returns empty array for empty input', () => {
    expect(diversityRerank([])).toEqual([]);
  });

  it('returns single game unchanged', () => {
    const games = [makeScoredGame('1', 0.9)];
    expect(diversityRerank(games)).toEqual(games);
  });

  it('keeps the top game in first position', () => {
    const games = [
      makeScoredGame('1', 0.9, ['Strategy']),
      makeScoredGame('2', 0.8, ['Strategy']),
      makeScoredGame('3', 0.7, ['Party']),
    ];
    const result = diversityRerank(games);
    expect(result[0].game.id).toBe('1');
  });

  it('promotes diverse games higher than pure score order', () => {
    // All strategy games + one party game with lower score
    const games = [
      makeScoredGame('s1', 0.9, ['Strategy'], ['Area Control']),
      makeScoredGame('s2', 0.85, ['Strategy'], ['Area Control']),
      makeScoredGame('s3', 0.82, ['Strategy'], ['Hand Management']),
      makeScoredGame('p1', 0.80, ['Party', 'Social Deduction'], ['Bluffing']),
      makeScoredGame('s4', 0.78, ['Strategy'], ['Area Control']),
    ];

    const result = diversityRerank(games);

    // The party game should be promoted higher than position 4
    // (because it adds diversity that the strategy games don't)
    const partyIdx = result.findIndex((r) => r.game.id === 'p1');
    expect(partyIdx).toBeLessThan(4);
  });

  it('does not crash with games that have no tags', () => {
    const games = [
      makeScoredGame('1', 0.9, [], []),
      makeScoredGame('2', 0.8, [], []),
    ];
    expect(() => diversityRerank(games)).not.toThrow();
    expect(diversityRerank(games)).toHaveLength(2);
  });

  it('preserves all games (no games lost)', () => {
    const games = Array.from({ length: 15 }, (_, i) =>
      makeScoredGame(`g${i}`, 0.9 - i * 0.01, [i % 2 === 0 ? 'Strategy' : 'Party']),
    );
    const result = diversityRerank(games);
    expect(result).toHaveLength(15);

    const ids = new Set(result.map((r) => r.game.id));
    expect(ids.size).toBe(15);
  });
});
