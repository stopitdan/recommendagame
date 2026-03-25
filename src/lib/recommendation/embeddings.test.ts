/**
 * Tests for the game/preference embedding system.
 *
 * Validates vector generation, normalization, cosine similarity,
 * and that similar games/preferences produce similar vectors.
 */

import { describe, it, expect } from 'vitest';
import {
  gameToVector,
  preferencesToVector,
  cosineSimilarity,
  normalize,
  generateEmbeddings,
  VECTOR_DIM,
} from './embeddings';
import type { Game } from '@/types/game';
import type { QuestionnaireState } from '@/types/questionnaire';

// ─── Helpers ─────────────────────────────────────────────────

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
    playerCount: { min: 2, max: 4 },
    playTime: { min: 30, max: 60, average: 45 },
    complexity: 2.5,
    rating: 7.5,
    ratingCount: 5000,
    ...overrides,
  };
}

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

// ─── Vector Generation ───────────────────────────────────────

describe('gameToVector', () => {
  it('produces a vector of correct dimension', () => {
    const vec = gameToVector(makeGame());
    expect(vec).toHaveLength(VECTOR_DIM);
  });

  it('sets non-zero values for game attributes', () => {
    const vec = gameToVector(makeGame());
    const nonZero = vec.filter((v) => v !== 0).length;
    expect(nonZero).toBeGreaterThan(0);
  });

  it('produces different vectors for different games', () => {
    const strategyGame = gameToVector(makeGame({
      categories: ['Strategy', 'War'],
      mechanics: ['Area Control'],
      themes: ['Medieval'],
    }));
    const partyGame = gameToVector(makeGame({
      categories: ['Party', 'Family'],
      mechanics: ['Dice Rolling'],
      themes: ['Humor'],
    }));

    // Not identical
    expect(strategyGame).not.toEqual(partyGame);
  });

  it('handles games with missing optional fields', () => {
    const vec = gameToVector(makeGame({
      playerCount: undefined,
      playTime: undefined,
      complexity: undefined,
      rating: undefined,
      ratingCount: undefined,
    }));
    expect(vec).toHaveLength(VECTOR_DIM);
    // Should still have non-zero values from categories/mechanics/themes
    const nonZero = vec.filter((v) => v !== 0).length;
    expect(nonZero).toBeGreaterThan(0);
  });
});

describe('preferencesToVector', () => {
  it('produces a vector of correct dimension', () => {
    const vec = preferencesToVector(makePrefs());
    expect(vec).toHaveLength(VECTOR_DIM);
  });

  it('produces a normalized vector (unit length)', () => {
    const vec = preferencesToVector(makePrefs());
    const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 5);
  });

  it('produces different vectors for different preferences', () => {
    const strategy = preferencesToVector(makePrefs({ genres: ['Strategy'], moods: ['brain-teaser'] }));
    const party = preferencesToVector(makePrefs({ genres: ['Party'], moods: ['social'] }));
    expect(strategy).not.toEqual(party);
  });
});

// ─── Cosine Similarity ───────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const vec = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it('returns 0 if either vector is all zeros', () => {
    const a = [1, 2, 3];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

// ─── Normalize ───────────────────────────────────────────────

describe('normalize', () => {
  it('produces a unit-length vector', () => {
    const vec = normalize([3, 4]);
    const magnitude = Math.sqrt(vec[0] ** 2 + vec[1] ** 2);
    expect(magnitude).toBeCloseTo(1.0, 5);
  });

  it('handles zero vector gracefully', () => {
    const vec = normalize([0, 0, 0]);
    expect(vec).toEqual([0, 0, 0]);
  });
});

// ─── Semantic Similarity ─────────────────────────────────────

describe('semantic similarity', () => {
  it('strategy game is more similar to strategy prefs than party prefs', () => {
    const strategyGame = normalize(gameToVector(makeGame({
      categories: ['Strategy', 'War'],
      mechanics: ['Area Control', 'Hand Management'],
      themes: ['Medieval'],
      complexity: 3.5,
    })));

    const strategyPrefs = preferencesToVector(makePrefs({
      genres: ['Strategy'],
      moods: ['brain-teaser'],
      complexity: { min: 3, max: 5 },
    }));

    const partyPrefs = preferencesToVector(makePrefs({
      genres: ['Party', 'Family'],
      moods: ['social', 'chill'],
      complexity: { min: 1, max: 2 },
    }));

    const simToStrategy = cosineSimilarity(strategyGame, strategyPrefs);
    const simToParty = cosineSimilarity(strategyGame, partyPrefs);

    expect(simToStrategy).toBeGreaterThan(simToParty);
  });

  it('similar games have higher similarity than dissimilar games', () => {
    const gameA = normalize(gameToVector(makeGame({
      id: 'a',
      categories: ['Strategy'],
      mechanics: ['Deck Building'],
      themes: ['Sci-Fi'],
      complexity: 3.0,
    })));

    const gameB = normalize(gameToVector(makeGame({
      id: 'b',
      categories: ['Strategy'],
      mechanics: ['Deck Building'],
      themes: ['Fantasy'],
      complexity: 2.8,
    })));

    const gameC = normalize(gameToVector(makeGame({
      id: 'c',
      categories: ['Party', 'Trivia'],
      mechanics: ['Dice Rolling'],
      themes: ['Humor'],
      complexity: 1.2,
    })));

    const simAB = cosineSimilarity(gameA, gameB);
    const simAC = cosineSimilarity(gameA, gameC);

    expect(simAB).toBeGreaterThan(simAC);
  });
});

// ─── Batch Generation ────────────────────────────────────────

describe('generateEmbeddings', () => {
  it('generates embeddings for all games', () => {
    const games = [makeGame({ id: 'g1' }), makeGame({ id: 'g2' })];
    const results = generateEmbeddings(games);

    expect(results).toHaveLength(2);
    expect(results[0].gameId).toBe('g1');
    expect(results[1].gameId).toBe('g2');
  });

  it('produces normalized embeddings', () => {
    const [emb] = generateEmbeddings([makeGame()]);
    const magnitude = Math.sqrt(emb.embedding.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 5);
  });

  it('produces correct dimension embeddings', () => {
    const [emb] = generateEmbeddings([makeGame()]);
    expect(emb.embedding).toHaveLength(VECTOR_DIM);
  });
});
