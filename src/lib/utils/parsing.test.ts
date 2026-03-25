/**
 * Tests for shared parsing and normalization utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  stripHtml,
  ensureArray,
  parseOptionalInt,
  parseOptionalFloat,
  normalizeRating,
  clamp,
} from './parsing';

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('decodes &amp;', () => {
    expect(stripHtml('Rock &amp; Roll')).toBe('Rock & Roll');
  });

  it('decodes &lt; and &gt;', () => {
    expect(stripHtml('1 &lt; 2 &gt; 0')).toBe('1 < 2 > 0');
  });

  it('decodes &quot;', () => {
    expect(stripHtml('&quot;quoted&quot;')).toBe('"quoted"');
  });

  it('decodes &#39; (apostrophe)', () => {
    expect(stripHtml('it&#39;s')).toBe("it's");
  });

  it('decodes &#10; (newline)', () => {
    expect(stripHtml('line1&#10;line2')).toBe('line1\nline2');
  });

  it('decodes &nbsp;', () => {
    expect(stripHtml('hello&nbsp;world')).toBe('hello world');
  });

  it('trims whitespace', () => {
    expect(stripHtml('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('handles complex HTML from BGG', () => {
    const bggHtml = '<p>A game about&amp;nbsp;trading.</p>&#10;<br/>Good for 2-4 players.';
    const result = stripHtml(bggHtml);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('trading');
    expect(result).toContain('Good for 2-4 players');
  });
});

describe('ensureArray', () => {
  it('wraps a single value in an array', () => {
    expect(ensureArray('hello')).toEqual(['hello']);
  });

  it('returns an array unchanged', () => {
    expect(ensureArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('returns empty array for undefined', () => {
    expect(ensureArray(undefined)).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(ensureArray(null)).toEqual([]);
  });

  it('wraps objects', () => {
    const obj = { id: 1 };
    expect(ensureArray(obj)).toEqual([{ id: 1 }]);
  });

  it('handles empty arrays', () => {
    expect(ensureArray([])).toEqual([]);
  });
});

describe('parseOptionalInt', () => {
  it('parses valid integers', () => {
    expect(parseOptionalInt('42')).toBe(42);
    expect(parseOptionalInt('0')).toBe(0);
    expect(parseOptionalInt('-5')).toBe(-5);
  });

  it('returns undefined for undefined', () => {
    expect(parseOptionalInt(undefined)).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(parseOptionalInt(null)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseOptionalInt('')).toBeUndefined();
  });

  it('returns undefined for non-numeric strings', () => {
    expect(parseOptionalInt('abc')).toBeUndefined();
    expect(parseOptionalInt('Not Ranked')).toBeUndefined();
  });

  it('parses integers from float strings (truncates)', () => {
    expect(parseOptionalInt('3.7')).toBe(3);
  });
});

describe('parseOptionalFloat', () => {
  it('parses valid floats', () => {
    expect(parseOptionalFloat('3.14')).toBeCloseTo(3.14);
    expect(parseOptionalFloat('0.5')).toBeCloseTo(0.5);
    expect(parseOptionalFloat('42')).toBe(42);
  });

  it('returns undefined for undefined', () => {
    expect(parseOptionalFloat(undefined)).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(parseOptionalFloat(null)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseOptionalFloat('')).toBeUndefined();
  });

  it('returns undefined for non-numeric strings', () => {
    expect(parseOptionalFloat('abc')).toBeUndefined();
  });
});

describe('normalizeRating', () => {
  it('normalizes 0-5 scale to 0-10', () => {
    expect(normalizeRating(4.47, 5, 10)).toBe(8.9);
    expect(normalizeRating(5, 5, 10)).toBe(10);
    expect(normalizeRating(2.5, 5, 10)).toBe(5);
  });

  it('returns undefined for zero or negative', () => {
    expect(normalizeRating(0, 5, 10)).toBeUndefined();
    expect(normalizeRating(-1, 5, 10)).toBeUndefined();
  });

  it('normalizes 0-100 scale to 0-10', () => {
    expect(normalizeRating(85, 100, 10)).toBe(8.5);
  });

  it('rounds to one decimal place', () => {
    expect(normalizeRating(3.33, 5, 10)).toBe(6.7);
  });
});

describe('clamp', () => {
  it('clamps below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps above max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns value when in range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('returns min when equal to min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when equal to max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});
