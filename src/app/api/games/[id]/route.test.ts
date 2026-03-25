/**
 * Tests for GET /api/games/[id]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase before importing the route
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

import { GET } from './route';
import { NextRequest } from 'next/server';

function makeRequest(id: string) {
  return {
    request: new NextRequest(`http://localhost/api/games/${id}`),
    params: Promise.resolve({ id }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/games/[id]', () => {
  it('returns a game when found', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'bgg-13',
        source: 'bgg',
        source_id: '13',
        name: 'Catan',
        description: 'Trade and build.',
        year_published: 1995,
        types: ['board'],
        min_players: 3,
        max_players: 4,
        recommended_players: 4,
        min_play_time: 60,
        max_play_time: 120,
        avg_play_time: 90,
        complexity: 2.3,
        rating: 7.2,
        rating_count: 95000,
        categories: ['Strategy'],
        mechanics: ['Dice Rolling'],
        themes: [],
        platforms: [],
        thumbnail_url: null,
        image_url: null,
        source_url: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      error: null,
    });

    const { request, params } = makeRequest('bgg-13');
    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.game.name).toBe('Catan');
    expect(data.game.id).toBe('bgg-13');
  });

  it('returns 404 when game not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const { request, params } = makeRequest('bgg-999999');
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
  });
});
