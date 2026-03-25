/**
 * Tests for the in-memory cache.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryCache } from './cache';

describe('MemoryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', () => {
    const cache = new MemoryCache<string>(60);
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  it('returns null for missing keys', () => {
    const cache = new MemoryCache<string>(60);
    expect(cache.get('missing')).toBeNull();
  });

  it('expires entries after TTL', () => {
    const cache = new MemoryCache<string>(10); // 10 second TTL
    cache.set('key', 'value');

    expect(cache.get('key')).toBe('value');

    // Advance time past TTL
    vi.advanceTimersByTime(11000);

    expect(cache.get('key')).toBeNull();
  });

  it('does not expire before TTL', () => {
    const cache = new MemoryCache<string>(10);
    cache.set('key', 'value');

    vi.advanceTimersByTime(5000); // Half TTL

    expect(cache.get('key')).toBe('value');
  });

  it('evicts oldest entry when at capacity', () => {
    const cache = new MemoryCache<string>(60, 2); // max 2 entries
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3'); // Should evict 'a'

    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });

  it('has() returns true for existing keys', () => {
    const cache = new MemoryCache<string>(60);
    cache.set('key', 'value');
    expect(cache.has('key')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  it('clear() removes all entries', () => {
    const cache = new MemoryCache<string>(60);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeNull();
  });

  it('tracks size correctly', () => {
    const cache = new MemoryCache<string>(60);
    expect(cache.size).toBe(0);
    cache.set('a', '1');
    expect(cache.size).toBe(1);
    cache.set('b', '2');
    expect(cache.size).toBe(2);
  });

  it('works with complex objects', () => {
    const cache = new MemoryCache<{ games: string[]; count: number }>(60);
    const data = { games: ['Catan', 'Pandemic'], count: 2 };
    cache.set('results', data);
    expect(cache.get('results')).toEqual(data);
  });
});
