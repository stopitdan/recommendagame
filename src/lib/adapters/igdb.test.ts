/**
 * Tests for the IGDB adapter.
 *
 * Mocks fetch to test mapping from IGDB API responses
 * to our unified Game schema.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Set env vars before import
vi.stubEnv('IGDB_CLIENT_ID', 'test-client-id');
vi.stubEnv('IGDB_CLIENT_SECRET', 'test-client-secret');

import { igdbAdapter, fetchIgdbBatch, clearTokenCache } from './igdb';

// ─── Helpers ─────────────────────────────────────────────────

function makeTwitchTokenResponse() {
  return new Response(JSON.stringify({
    access_token: 'test-token',
    expires_in: 3600,
    token_type: 'bearer',
  }));
}

function makeIgdbGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 1942,
    name: 'The Witcher 3: Wild Hunt',
    summary: 'An open-world RPG set in a visually stunning fantasy universe.',
    url: 'https://www.igdb.com/games/the-witcher-3',
    first_release_date: 1431993600, // 2015-05-19
    total_rating: 92.5,
    total_rating_count: 1500,
    genres: [{ id: 12, name: 'Role-playing (RPG)' }, { id: 31, name: 'Adventure' }],
    themes: [{ id: 1, name: 'Fantasy' }, { id: 17, name: 'Open world' }],
    game_modes: [{ id: 1, name: 'Single player' }],
    platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
    player_perspectives: [{ id: 2, name: 'Third person' }],
    keywords: [{ id: 121, name: 'sword' }, { id: 234, name: 'magic' }],
    cover: { id: 123, image_id: 'co1r7f' },
    multiplayer_modes: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearTokenCache(); // Ensure fresh token request per test
});

// ─── Tests ───────────────────────────────────────────────────

describe('igdbAdapter.search', () => {
  it('maps IGDB response to Game schema', async () => {
    // First call: token request, second: game search
    mockFetch
      .mockResolvedValueOnce(makeTwitchTokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([makeIgdbGame()])));

    const results = await igdbAdapter.search('witcher');

    expect(results).toHaveLength(1);
    const game = results[0];

    expect(game.id).toBe('igdb-1942');
    expect(game.source).toBe('igdb');
    expect(game.sourceId).toBe('1942');
    expect(game.name).toBe('The Witcher 3: Wild Hunt');
    expect(game.types).toEqual(['video']);
    expect(game.yearPublished).toBe(2015);

    // Rating normalized from 0-100 to 0-10
    expect(game.rating).toBeCloseTo(9.3, 0);
    expect(game.ratingCount).toBe(1500);

    // Genres → categories
    expect(game.categories).toContain('Role-playing (RPG)');
    expect(game.categories).toContain('Adventure');

    // Themes
    expect(game.themes).toContain('Fantasy');
    expect(game.themes).toContain('Open world');

    // Keywords + perspectives + modes → mechanics
    expect(game.mechanics).toContain('sword');
    expect(game.mechanics).toContain('Third person');
    expect(game.mechanics).toContain('Single player');

    // Platforms
    expect(game.platforms).toContain('PC');

    // Images
    expect(game.imageUrl).toContain('co1r7f');
    expect(game.thumbnailUrl).toContain('t_thumb');
  });

  it('returns empty array on fetch error', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTwitchTokenResponse())
      .mockRejectedValueOnce(new Error('network error'));

    const results = await igdbAdapter.search('witcher');
    expect(results).toEqual([]);
  });
});

describe('igdbAdapter.getById', () => {
  it('returns a single game by ID', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTwitchTokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([makeIgdbGame()])));

    const game = await igdbAdapter.getById('1942');

    expect(game).not.toBeNull();
    expect(game!.id).toBe('igdb-1942');
  });

  it('returns null when game not found', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTwitchTokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([])));

    const game = await igdbAdapter.getById('999999');
    expect(game).toBeNull();
  });
});

describe('igdbAdapter.getPopular', () => {
  it('returns popular games sorted by rating', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTwitchTokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([
        makeIgdbGame({ id: 1, name: 'Game A', total_rating: 95 }),
        makeIgdbGame({ id: 2, name: 'Game B', total_rating: 90 }),
      ])));

    const games = await igdbAdapter.getPopular!(5);

    expect(games).toHaveLength(2);
    expect(games[0].name).toBe('Game A');
    expect(games[1].name).toBe('Game B');
  });
});

describe('multiplayer mode mapping', () => {
  it('extracts max players from multiplayer modes', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTwitchTokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([
        makeIgdbGame({
          multiplayer_modes: [
            { id: 1, offlinemax: 4, onlinemax: 16 },
          ],
          game_modes: [
            { id: 1, name: 'Single player' },
            { id: 2, name: 'Multiplayer' },
          ],
        }),
      ])));

    const results = await igdbAdapter.search('test');
    const game = results[0];

    expect(game.playerCount?.max).toBe(16);
    expect(game.playerCount?.min).toBe(1);
  });

  it('defaults multiplayer games to max 4 players when modes not specified', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTwitchTokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([
        makeIgdbGame({
          multiplayer_modes: [],
          game_modes: [{ id: 2, name: 'Multiplayer' }],
        }),
      ])));

    const results = await igdbAdapter.search('test');
    expect(results[0].playerCount?.max).toBe(4);
  });
});

describe('fetchIgdbBatch', () => {
  it('fetches a batch of games for crawling', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTwitchTokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([
        makeIgdbGame({ id: 1 }),
        makeIgdbGame({ id: 2 }),
      ])));

    const batch = await fetchIgdbBatch(0, 500);

    expect(batch).toHaveLength(2);
    expect(batch[0].source).toBe('igdb');
  });
});

describe('edge cases', () => {
  it('handles missing optional fields', async () => {
    mockFetch
      .mockResolvedValueOnce(makeTwitchTokenResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        id: 999,
        name: 'Minimal Game',
      }])));

    const results = await igdbAdapter.search('minimal');
    const game = results[0];

    expect(game.name).toBe('Minimal Game');
    expect(game.description).toBe('');
    expect(game.categories).toEqual([]);
    expect(game.themes).toEqual([]);
    expect(game.mechanics).toEqual([]);
    expect(game.platforms).toEqual([]);
    expect(game.yearPublished).toBeUndefined();
    expect(game.rating).toBeUndefined(); // 0 rating → undefined
  });
});
