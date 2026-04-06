/**
 * Tests for GET /api/games/search
 *
 * Focuses on the fuzzy search fallback: when exact tsvector search returns
 * zero results, the API falls back to pg_trgm trigram similarity and returns
 * a fuzzyMatch hint in the response.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock rate limiting (allow all) ---
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  LIMITS: { medium: {} },
}));

// --- Mock Redis (no caching in tests) ---
vi.mock('@/lib/redis', () => ({
  redisCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

// --- Mock game sync (no-op) ---
vi.mock('@/lib/sync/game-sync', () => ({
  syncSearchResults: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock external adapters (return empty) ---
vi.mock('@/lib/adapters/bgg', () => ({
  bggAdapter: { source: 'bgg', search: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/lib/adapters/rawg', () => ({
  rawgAdapter: { source: 'rawg', search: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/lib/adapters/local', () => ({
  localAdapter: { source: 'local', search: vi.fn().mockResolvedValue([]) },
}));

// --- Mock Supabase ---
const mockRpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: mockRpc }),
}));

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

import { GET } from './route';
import { NextRequest } from 'next/server';

const SAMPLE_GAME_ROW = {
  id: 'bgg-10547',
  source: 'bgg',
  source_id: '10547',
  name: 'Betrayal at House on the Hill',
  description: 'A spooky cooperative game.',
  year_published: 2004,
  types: ['board'],
  min_players: 3,
  max_players: 6,
  recommended_players: 5,
  min_play_time: 60,
  max_play_time: 60,
  avg_play_time: 60,
  complexity: 2.4,
  rating: 7.1,
  rating_count: 52000,
  categories: ['Horror'],
  mechanics: ['Dice Rolling', 'Modular Board'],
  themes: ['Horror'],
  platforms: [],
  thumbnail_url: null,
  image_url: null,
  source_url: null,
  designers: [],
  publishers: [],
  is_expansion: false,
};

function makeRequest(query: string, params?: Record<string, string>) {
  const url = new URL('http://localhost/api/games/search');
  url.searchParams.set('q', query);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/games/search', () => {
  it('returns 400 when q param is missing', async () => {
    const req = new NextRequest('http://localhost/api/games/search');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required parameter');
  });

  it('returns exact matches without fuzzyMatch flag', async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'search_games_by_name') {
        return Promise.resolve({ data: [SAMPLE_GAME_ROW] });
      }
      return Promise.resolve({ data: [] });
    });

    const res = await GET(makeRequest('Betrayal'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results.length).toBe(1);
    expect(body.results[0].name).toBe('Betrayal at House on the Hill');
    expect(body.fuzzyMatch).toBeUndefined();
    expect(body.correctedQuery).toBeUndefined();
  });

  it('falls back to fuzzy search when exact match returns nothing', async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'search_games_by_name') {
        return Promise.resolve({ data: [] });
      }
      if (fn === 'fuzzy_search_games_by_name') {
        return Promise.resolve({
          data: [{ ...SAMPLE_GAME_ROW, similarity_score: 0.65 }],
        });
      }
      return Promise.resolve({ data: [] });
    });

    const res = await GET(makeRequest('Bertrayal'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results.length).toBe(1);
    expect(body.results[0].name).toBe('Betrayal at House on the Hill');
    expect(body.fuzzyMatch).toBe(true);
    expect(body.correctedQuery).toBe('Betrayal at House on the Hill');
  });

  it('returns empty results when both exact and fuzzy find nothing', async () => {
    mockRpc.mockResolvedValue({ data: [] });

    const res = await GET(makeRequest('xyznonexistent'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results.length).toBe(0);
    expect(body.fuzzyMatch).toBeUndefined();
  });
});
