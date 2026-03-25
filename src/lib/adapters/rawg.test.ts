/**
 * Tests for the RAWG adapter mapping logic.
 *
 * Mocks fetch to avoid hitting the real API. Tests focus on
 * response mapping, rating normalization, and field extraction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rawgAdapter } from './rawg';

// Mock the RAWG API key
vi.stubEnv('RAWG_API_KEY', 'test-key');

const mockRawgListItem = {
  id: 3498,
  slug: 'grand-theft-auto-v',
  name: 'Grand Theft Auto V',
  released: '2013-09-17',
  tba: false,
  background_image: 'https://media.rawg.io/gta.jpg',
  rating: 4.47,
  rating_top: 5,
  ratings: [
    { id: 5, title: 'exceptional', count: 3000, percent: 50 },
    { id: 4, title: 'recommended', count: 2000, percent: 33 },
  ],
  ratings_count: 6000,
  metacritic: 97,
  playtime: 30,
  suggestions_count: 400,
  updated: '2024-01-01',
  reviews_count: 100,
  saturated_color: '0f0f0f',
  dominant_color: '0f0f0f',
  platforms: [
    { platform: { id: 4, name: 'PC', slug: 'pc', image: null, year_end: null, year_start: null, games_count: 1000, image_background: '' }, released_at: '2013-09-17', requirements_en: null, requirements_ru: null },
  ],
  parent_platforms: [
    { platform: { id: 1, name: 'PC', slug: 'pc' } },
    { platform: { id: 2, name: 'PlayStation', slug: 'playstation' } },
  ],
  genres: [
    { id: 4, name: 'Action', slug: 'action', games_count: 1000, image_background: '' },
    { id: 3, name: 'Adventure', slug: 'adventure', games_count: 800, image_background: '' },
  ],
  stores: null,
  tags: [
    { id: 1, name: 'Open World', slug: 'open-world', language: 'eng', games_count: 500, image_background: '' },
    { id: 2, name: 'Singleplayer', slug: 'singleplayer', language: 'eng', games_count: 2000, image_background: '' },
    { id: 3, name: 'Мультиплеер', slug: 'multiplayer-ru', language: 'rus', games_count: 100, image_background: '' },
  ],
  esrb_rating: { id: 4, name: 'Mature', slug: 'mature' },
  short_screenshots: null,
  added: 20000,
  added_by_status: null,
  reviews_text_count: 50,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('rawgAdapter.search', () => {
  it('maps list items to Game objects with correct fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        count: 1,
        next: null,
        previous: null,
        results: [mockRawgListItem],
      }),
    }));

    const games = await rawgAdapter.search('gta');

    expect(games).toHaveLength(1);
    const game = games[0];

    expect(game.id).toBe('rawg-3498');
    expect(game.source).toBe('rawg');
    expect(game.sourceId).toBe('3498');
    expect(game.name).toBe('Grand Theft Auto V');
    expect(game.types).toEqual(['video']);
    expect(game.yearPublished).toBe(2013);
    expect(game.sourceUrl).toBe('https://rawg.io/games/grand-theft-auto-v');
  });

  it('normalizes rating from 0-5 to 0-10 scale', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        count: 1, next: null, previous: null,
        results: [mockRawgListItem],
      }),
    }));

    const games = await rawgAdapter.search('gta');
    // 4.47 * 2 = 8.94, rounded to 1 decimal = 8.9
    expect(games[0].rating).toBe(8.9);
  });

  it('converts playtime from hours to minutes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        count: 1, next: null, previous: null,
        results: [mockRawgListItem],
      }),
    }));

    const games = await rawgAdapter.search('gta');
    // 30 hours = 1800 minutes
    expect(games[0].playTime?.average).toBe(1800);
    expect(games[0].playTime?.max).toBe(1800);
  });

  it('extracts platforms from parent_platforms', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        count: 1, next: null, previous: null,
        results: [mockRawgListItem],
      }),
    }));

    const games = await rawgAdapter.search('gta');
    expect(games[0].platforms).toEqual(['PC', 'PlayStation']);
  });

  it('filters tags to English only for themes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        count: 1, next: null, previous: null,
        results: [mockRawgListItem],
      }),
    }));

    const games = await rawgAdapter.search('gta');
    expect(games[0].themes).toEqual(['Open World', 'Singleplayer']);
    // Russian tag should be filtered out
    expect(games[0].themes).not.toContain('Мультиплеер');
  });

  it('maps genres to categories', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        count: 1, next: null, previous: null,
        results: [mockRawgListItem],
      }),
    }));

    const games = await rawgAdapter.search('gta');
    expect(games[0].categories).toEqual(['Action', 'Adventure']);
  });

  it('returns empty array on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const games = await rawgAdapter.search('gta');
    expect(games).toEqual([]);
  });

  it('returns empty array when no results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        count: 0, next: null, previous: null,
        results: [],
      }),
    }));

    const games = await rawgAdapter.search('xyznonexistent');
    expect(games).toEqual([]);
  });

  it('handles missing rating gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        count: 1, next: null, previous: null,
        results: [{ ...mockRawgListItem, rating: 0 }],
      }),
    }));

    const games = await rawgAdapter.search('test');
    expect(games[0].rating).toBeUndefined();
  });

  it('handles missing playtime gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        count: 1, next: null, previous: null,
        results: [{ ...mockRawgListItem, playtime: 0 }],
      }),
    }));

    const games = await rawgAdapter.search('test');
    expect(games[0].playTime).toBeUndefined();
  });
});

describe('rawgAdapter.getById', () => {
  it('fetches detail endpoint and includes description', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockRawgListItem,
        description: '<p>A bold open-world game.</p>',
        description_raw: 'A bold open-world game.',
        developers: [{ id: 1, name: 'Rockstar North', slug: 'rockstar-north', games_count: 10, image_background: '' }],
        publishers: [{ id: 1, name: 'Rockstar Games', slug: 'rockstar-games', games_count: 20, image_background: '' }],
      }),
    }));

    const game = await rawgAdapter.getById('3498');

    expect(game).not.toBeNull();
    expect(game!.name).toBe('Grand Theft Auto V');
    expect(game!.description).toBe('A bold open-world game.');
  });

  it('returns null on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    const game = await rawgAdapter.getById('999999');
    expect(game).toBeNull();
  });
});
