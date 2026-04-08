import { describe, it, expect } from 'vitest';
import { buildCanonicalKey, hashCanonicalKey } from './semantic-cache';
import type { QuestionnaireState } from '@/types/questionnaire';

function makePrefs(overrides: Partial<QuestionnaireState> = {}): QuestionnaireState {
  return {
    freeText: '',
    gameTypes: [],
    playerCount: { min: 1, max: 10 },
    timePresets: [],
    complexity: { min: 1, max: 5 },
    genres: [],
    moods: [],
    ...overrides,
  };
}

describe('buildCanonicalKey', () => {
  it('produces the same key for different freeText with same parsed fields', () => {
    // "deck building for 2" and "2 player deck builders" both parse to
    // the same structured prefs after LLM parsing + merging
    const prefs1 = makePrefs({
      freeText: 'deck building for 2',
      genres: ['Deck Building'],
      playerCount: { min: 2, max: 2 },
    });
    const prefs2 = makePrefs({
      freeText: '2 player deck builders',
      genres: ['Deck Building'],
      playerCount: { min: 2, max: 2 },
    });

    const key1 = buildCanonicalKey(prefs1, 'any');
    const key2 = buildCanonicalKey(prefs2, 'any');
    expect(key1).toBe(key2);
  });

  it('sorts arrays so order does not matter', () => {
    const prefs1 = makePrefs({ genres: ['Strategy', 'RPG'], moods: ['competitive', 'chill'] });
    const prefs2 = makePrefs({ genres: ['RPG', 'Strategy'], moods: ['chill', 'competitive'] });

    expect(buildCanonicalKey(prefs1, 'any')).toBe(buildCanonicalKey(prefs2, 'any'));
  });

  it('omits default player count and complexity', () => {
    const defaults = makePrefs();
    const key = buildCanonicalKey(defaults, 'popular');
    const parsed = JSON.parse(key);
    expect(parsed.pc).toBeUndefined();
    expect(parsed.cx).toBeUndefined();
  });

  it('includes non-default player count', () => {
    const prefs = makePrefs({ playerCount: { min: 2, max: 4 } });
    const key = buildCanonicalKey(prefs, 'popular');
    const parsed = JSON.parse(key);
    expect(parsed.pc).toEqual({ min: 2, max: 4 });
  });

  it('differentiates by popularity mode', () => {
    const prefs = makePrefs({ genres: ['Strategy'] });
    const key1 = buildCanonicalKey(prefs, 'popular');
    const key2 = buildCanonicalKey(prefs, 'hidden-gems');
    expect(key1).not.toBe(key2);
  });

  it('includes LLM-parsed similarTo', () => {
    const prefs = makePrefs({
      llmParsed: {
        gameTypes: [],
        genres: [],
        mechanics: [],
        moods: [],
        complexity: null,
        playerCount: null,
        timePresets: [],
        similarTo: ['Catan', 'Dominion'],
        franchiseSearch: [],
        designers: [],
        keywords: [],
        excludedGenres: [],
        excludedMechanics: [],
      },
    });
    const key = buildCanonicalKey(prefs, 'popular');
    const parsed = JSON.parse(key);
    expect(parsed.sim).toEqual(['Catan', 'Dominion']);
  });
});

describe('hashCanonicalKey', () => {
  it('produces a 32-char hex string', () => {
    const hash = hashCanonicalKey('{"g":["Strategy"]}');
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
  });

  it('is deterministic', () => {
    const input = '{"g":["RPG"],"pc":{"min":2,"max":4}}';
    expect(hashCanonicalKey(input)).toBe(hashCanonicalKey(input));
  });
});
