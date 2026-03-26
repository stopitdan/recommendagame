import { describe, it, expect } from 'vitest';
import { normalizeText, levenshteinDistance, isFuzzyMatch } from './normalize';

describe('normalizeText', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeText('I Like ROGUELIKE Games!')).toBe('games i like roguelike');
  });

  it('sorts words alphabetically', () => {
    expect(normalizeText('strategy games for two')).toBe('for games strategy two');
  });

  it('collapses whitespace', () => {
    expect(normalizeText('  lots   of    spaces  ')).toBe('lots of spaces');
  });

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });

  it('makes word order irrelevant', () => {
    expect(normalizeText('roguelike deck builder')).toBe(normalizeText('deck builder roguelike'));
  });

  it('strips numbers but keeps them', () => {
    expect(normalizeText('2 player game')).toBe('2 game player');
  });
});

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
    expect(levenshteinDistance('hello', '')).toBe(5);
  });

  it('returns 1 for single character difference', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
  });

  it('handles transposition-like edits', () => {
    expect(levenshteinDistance('roguelike', 'roguelkie')).toBe(2);
  });

  it('returns full length for completely different strings', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });
});

describe('isFuzzyMatch', () => {
  it('matches identical strings', () => {
    expect(isFuzzyMatch('hello', 'hello')).toBe(true);
  });

  it('matches strings with small edit distance', () => {
    // "i like roguelike games" vs "i like roguelkie games" = 2 edits / 22 chars = 0.09
    expect(isFuzzyMatch('i like roguelike games', 'i like roguelkie games')).toBe(true);
  });

  it('rejects very different strings', () => {
    expect(isFuzzyMatch('strategy games', 'horror movies')).toBe(false);
  });

  it('matches empty strings', () => {
    expect(isFuzzyMatch('', '')).toBe(true);
  });

  it('respects custom threshold', () => {
    // "cat" vs "bat" = 1/3 = 0.33
    expect(isFuzzyMatch('cat', 'bat', 0.5)).toBe(true);
    expect(isFuzzyMatch('cat', 'bat', 0.2)).toBe(false);
  });
});
