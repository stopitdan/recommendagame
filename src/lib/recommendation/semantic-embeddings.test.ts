/**
 * Tests for semantic embedding text builders.
 * (Actual OpenAI API calls are not tested — only the text building logic.)
 */

import { describe, it, expect } from 'vitest';
import { gameToText, preferencesToText } from './semantic-embeddings';
import type { Game } from '@/types/game';
import type { QuestionnaireState } from '@/types/questionnaire';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'test-1',
    source: 'bgg',
    sourceId: '1',
    name: 'Test Game',
    description: 'A fun strategy game about building kingdoms.',
    types: ['board'],
    categories: ['Strategy', 'Medieval'],
    mechanics: ['Worker Placement', 'Area Control'],
    themes: ['Fantasy', 'Kingdom Building'],
    platforms: [],
    playerCount: { min: 2, max: 4 },
    complexity: 3.0,
    ...overrides,
  };
}

describe('gameToText', () => {
  it('includes name, description, categories, mechanics, themes', () => {
    const text = gameToText(makeGame());
    expect(text).toContain('Test Game');
    expect(text).toContain('building kingdoms');
    expect(text).toContain('Strategy');
    expect(text).toContain('Worker Placement');
    expect(text).toContain('Fantasy');
  });

  it('includes complexity and player count', () => {
    const text = gameToText(makeGame());
    expect(text).toContain('Complexity: 3/5');
    expect(text).toContain('Players: 2-4');
  });

  it('handles minimal game data', () => {
    const text = gameToText(makeGame({
      description: '',
      categories: [],
      mechanics: [],
      themes: [],
      playerCount: undefined,
      complexity: undefined,
    }));
    expect(text).toContain('Test Game');
    expect(text.length).toBeGreaterThan(0);
  });

  it('truncates long descriptions to 500 chars', () => {
    const longDesc = 'A'.repeat(1000);
    const text = gameToText(makeGame({ description: longDesc }));
    // 500 chars of description + name + metadata
    expect(text.indexOf('A'.repeat(501))).toBe(-1);
  });
});

describe('preferencesToText', () => {
  it('includes free text', () => {
    const prefs: QuestionnaireState = {
      freeText: 'roguelike deck builder',
      gameTypes: [],
      playerCount: { min: 1, max: 8 },
      timePresets: [],
      complexity: { min: 1, max: 5 },
      genres: [],
      moods: [],
    };
    const text = preferencesToText(prefs);
    expect(text).toContain('roguelike deck builder');
  });

  it('includes LLM-parsed data', () => {
    const prefs: QuestionnaireState = {
      freeText: 'something strategic',
      gameTypes: ['board'],
      playerCount: { min: 2, max: 4 },
      timePresets: [],
      complexity: { min: 1, max: 5 },
      genres: ['Strategy'],
      moods: ['brain-teaser'],
      llmParsed: {
        gameTypes: ['board'],
        genres: ['Strategy'],
        mechanics: ['Worker Placement'],
        moods: ['brain-teaser'],
        complexity: null,
        playerCount: null,
        timePresets: [],
        similarTo: ['Catan'],
        keywords: ['euro'],
      },
    };
    const text = preferencesToText(prefs);
    expect(text).toContain('Worker Placement');
    expect(text).toContain('Similar to: Catan');
    expect(text).toContain('Strategy');
  });

  it('returns fallback text when all fields empty', () => {
    const prefs: QuestionnaireState = {
      freeText: '',
      gameTypes: [],
      playerCount: { min: 1, max: 8 },
      timePresets: [],
      complexity: { min: 1, max: 5 },
      genres: [],
      moods: [],
    };
    const text = preferencesToText(prefs);
    expect(text).toBe('fun popular game');
  });
});
