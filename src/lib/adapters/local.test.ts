/**
 * Tests for the local data adapter (word games).
 */

import { describe, it, expect } from 'vitest';
import { localAdapter } from './local';

describe('localAdapter.search', () => {
  it('finds games by name', async () => {
    const results = await localAdapter.search('wordle');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Wordle');
    expect(results[0].source).toBe('local');
    expect(results[0].id).toBe('local-wordle');
  });

  it('searches descriptions too', async () => {
    const results = await localAdapter.search('five-letter');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Wordle');
  });

  it('searches categories', async () => {
    const results = await localAdapter.search('daily challenge');
    expect(results.length).toBeGreaterThan(0);
    // Multiple games have "Daily Challenge" category
  });

  it('is case-insensitive', async () => {
    const results = await localAdapter.search('WORDLE');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Wordle');
  });

  it('respects limit option', async () => {
    const results = await localAdapter.search('word', { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array for no matches', async () => {
    const results = await localAdapter.search('xyznonexistent');
    expect(results).toEqual([]);
  });
});

describe('localAdapter.getById', () => {
  it('returns a game by source ID', async () => {
    const game = await localAdapter.getById('wordle');
    expect(game).not.toBeNull();
    expect(game!.name).toBe('Wordle');
    expect(game!.types).toContain('word');
    expect(game!.source).toBe('local');
  });

  it('returns null for unknown ID', async () => {
    const game = await localAdapter.getById('nonexistent');
    expect(game).toBeNull();
  });
});

describe('localAdapter.getPopular', () => {
  it('returns games sorted by rating descending', async () => {
    const games = await localAdapter.getPopular(5);
    expect(games.length).toBeLessThanOrEqual(5);

    // Verify sorted by rating descending
    for (let i = 1; i < games.length; i++) {
      expect(games[i - 1].rating).toBeGreaterThanOrEqual(games[i].rating!);
    }
  });

  it('respects limit', async () => {
    const games = await localAdapter.getPopular(3);
    expect(games).toHaveLength(3);
  });
});

describe('local game data integrity', () => {
  it('all games have required fields', async () => {
    const games = await localAdapter.getPopular(100);

    for (const game of games) {
      expect(game.id).toMatch(/^local-/);
      expect(game.source).toBe('local');
      expect(game.sourceId).toBeTruthy();
      expect(game.name).toBeTruthy();
      expect(game.description).toBeTruthy();
      expect(game.types).toContain('word');
      expect(game.categories.length).toBeGreaterThan(0);
      expect(game.playerCount).toBeDefined();
      expect(game.playTime).toBeDefined();
      expect(game.complexity).toBeGreaterThanOrEqual(1);
      expect(game.complexity).toBeLessThanOrEqual(5);
      expect(game.rating).toBeGreaterThan(0);
      expect(game.rating).toBeLessThanOrEqual(10);
    }
  });
});
