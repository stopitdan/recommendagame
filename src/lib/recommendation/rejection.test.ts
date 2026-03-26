/**
 * Tests for the rejection learning module.
 */

import { describe, it, expect } from 'vitest';
import { computeRejectionPenalty } from './rejection';
import type { RejectionProfile } from './rejection';
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

function makeProfile(overrides: Partial<RejectionProfile> = {}): RejectionProfile {
  return {
    rejectedTags: new Map(),
    rejectedGameIds: new Set(),
    totalRejections: 0,
    ...overrides,
  };
}

describe('computeRejectionPenalty', () => {
  it('returns 0 for empty rejection profile', () => {
    const game = makeGame();
    const profile = makeProfile();
    expect(computeRejectionPenalty(game, profile)).toBe(0);
  });

  it('returns 1.0 for explicitly rejected game', () => {
    const game = makeGame({ id: 'rejected-1' });
    const profile = makeProfile({
      rejectedGameIds: new Set(['rejected-1']),
      totalRejections: 1,
    });
    expect(computeRejectionPenalty(game, profile)).toBe(1.0);
  });

  it('returns penalty > 0 for games matching rejected tags', () => {
    const game = makeGame({ categories: ['Horror'], mechanics: ['Dice Rolling'] });
    const profile = makeProfile({
      rejectedTags: new Map([['horror', 2], ['dice rolling', 1]]),
      totalRejections: 3,
    });
    const penalty = computeRejectionPenalty(game, profile);
    expect(penalty).toBeGreaterThan(0);
    expect(penalty).toBeLessThanOrEqual(0.8);
  });

  it('returns 0 for games with no matching rejected tags', () => {
    const game = makeGame({ categories: ['Strategy'], mechanics: ['Worker Placement'] });
    const profile = makeProfile({
      rejectedTags: new Map([['horror', 2], ['dice rolling', 1]]),
      totalRejections: 3,
    });
    expect(computeRejectionPenalty(game, profile)).toBe(0);
  });

  it('returns higher penalty for more tag matches', () => {
    const gameOneMatch = makeGame({ categories: ['Horror'], mechanics: ['Area Control'] });
    const gameTwoMatches = makeGame({ categories: ['Horror'], mechanics: ['Dice Rolling'] });

    const profile = makeProfile({
      rejectedTags: new Map([['horror', 3], ['dice rolling', 2]]),
      totalRejections: 5,
    });

    const penaltyOne = computeRejectionPenalty(gameOneMatch, profile);
    const penaltyTwo = computeRejectionPenalty(gameTwoMatches, profile);

    expect(penaltyTwo).toBeGreaterThan(penaltyOne);
  });

  it('caps penalty at 0.8', () => {
    const game = makeGame({
      categories: ['Horror', 'Zombie'],
      mechanics: ['Dice Rolling'],
      themes: ['Dark', 'Gore'],
    });
    const profile = makeProfile({
      rejectedTags: new Map([
        ['horror', 10], ['zombie', 10], ['dice rolling', 10],
        ['dark', 10], ['gore', 10],
      ]),
      totalRejections: 10,
    });
    expect(computeRejectionPenalty(game, profile)).toBeLessThanOrEqual(0.8);
  });

  it('returns 0 for games with no tags', () => {
    const game = makeGame({ categories: [], mechanics: [], themes: [] });
    const profile = makeProfile({
      rejectedTags: new Map([['horror', 2]]),
      totalRejections: 2,
    });
    expect(computeRejectionPenalty(game, profile)).toBe(0);
  });
});
