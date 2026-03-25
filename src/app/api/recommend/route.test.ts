/**
 * Tests for the /api/recommend endpoint.
 *
 * Mocks Supabase to test request validation, response shape,
 * and integration with the scoring engine.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock Supabase with factory (no external refs) ---
vi.mock('@supabase/supabase-js', () => {
  const chainable: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'not', 'contains', 'gt', 'lt', 'gte', 'lte', 'order', 'limit'];
  for (const m of methods) {
    chainable[m] = vi.fn();
  }
  for (const fn of Object.values(chainable)) {
    fn.mockReturnValue(chainable);
  }

  const mockFrom = vi.fn().mockReturnValue(chainable);
  const mockClient = { from: mockFrom };

  return {
    createClient: vi.fn().mockReturnValue(mockClient),
    __chain: chainable,
    __from: mockFrom,
  };
});

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

import { POST } from './route';
import * as supaModule from '@supabase/supabase-js';

// Access the mock internals
const { __chain: chain, __from: mockFrom } = supaModule as unknown as {
  __chain: Record<string, ReturnType<typeof vi.fn>>;
  __from: ReturnType<typeof vi.fn>;
};

// --- Helpers ---

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGameRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `bgg-${id}`,
    source: 'bgg',
    source_id: id,
    name: `Game ${id}`,
    description: 'A great game',
    year_published: 2020,
    types: ['board'],
    min_players: 2,
    max_players: 4,
    recommended_players: 3,
    min_play_time: 30,
    max_play_time: 60,
    avg_play_time: 45,
    complexity: 2.5,
    rating: 7.5,
    rating_count: 5000,
    categories: ['Strategy'],
    mechanics: ['Hand Management'],
    themes: ['Fantasy'],
    platforms: [],
    thumbnail_url: null,
    image_url: null,
    source_url: null,
    ...overrides,
  };
}

let testCounter = 0;

/** Each test gets unique prefs to avoid cache hits between tests */
function uniquePrefs(overrides: Record<string, unknown> = {}) {
  testCounter++;
  return {
    gameTypes: ['board'],
    playerCount: { min: 2, max: 4 },
    timePresets: ['medium'],
    complexity: { min: 2, max: 4 },
    genres: ['Strategy'],
    moods: ['competitive'],
    freeText: `test-${testCounter}`,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset chain to return itself
  for (const fn of Object.values(chain)) {
    fn.mockReturnValue(chain);
  }
  mockFrom.mockReturnValue(chain);
});

// --- Tests ---

describe('POST /api/recommend', () => {
  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/recommend', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid JSON body');
  });

  it('returns scored results with engine metadata', async () => {
    const gameRows = [
      makeGameRow('1', { rating: 9.0, rating_count: 10000 }),
      makeGameRow('2', { rating: 6.0, rating_count: 500 }),
    ];
    chain.limit.mockResolvedValueOnce({ data: gameRows, error: null });

    const res = await POST(makeRequest(uniquePrefs()) as any);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.engine).toMatch(/v1/);
    expect(data.count).toBe(2);
    expect(data.results).toHaveLength(2);
    expect(data.results[0]._score).toBeGreaterThan(data.results[1]._score);
    expect(data.results[0]._reasons).toBeDefined();
    expect(Array.isArray(data.results[0]._reasons)).toBe(true);
  });

  it('returns empty results when DB returns no candidates', async () => {
    chain.limit.mockResolvedValueOnce({ data: [], error: null });

    const res = await POST(makeRequest(uniquePrefs()) as any);
    const data = await res.json();
    expect(data.count).toBe(0);
    expect(data.results).toEqual([]);
  });

  it('respects limit parameter', async () => {
    const gameRows = Array.from({ length: 10 }, (_, i) =>
      makeGameRow(String(i), { rating: 9 - i * 0.1 }),
    );
    chain.limit.mockResolvedValueOnce({ data: gameRows, error: null });

    const res = await POST(makeRequest(uniquePrefs({ limit: 3 })) as any);
    const data = await res.json();
    expect(data.count).toBe(3);
    expect(data.results).toHaveLength(3);
  });

  it('includes totalCandidates in response', async () => {
    const gameRows = Array.from({ length: 8 }, (_, i) => makeGameRow(String(i)));
    chain.limit.mockResolvedValueOnce({ data: gameRows, error: null });

    const res = await POST(makeRequest(uniquePrefs({ limit: 3 })) as any);
    const data = await res.json();
    expect(data.totalCandidates).toBe(8);
    expect(data.count).toBe(3);
  });

  it('accepts popularity mode parameter', async () => {
    chain.limit.mockResolvedValueOnce({ data: [makeGameRow('1')], error: null });

    const res = await POST(makeRequest(uniquePrefs({ popularity: 'hidden-gems' })) as any);
    const data = await res.json();
    expect(data.popularity).toBe('hidden-gems');
  });

  it('returns empty results gracefully on DB error', async () => {
    chain.limit.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const res = await POST(makeRequest(uniquePrefs()) as any);
    const data = await res.json();
    expect(data.count).toBe(0);
  });
});
