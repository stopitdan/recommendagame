/**
 * Tests for favorites API routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase auth + db
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import { GET, POST } from './route';
import { NextRequest } from 'next/server';

beforeEach(() => {
  vi.clearAllMocks();

  // Default chain: from().select().eq().order()
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockEq.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert });
});

describe('GET /api/favorites', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it('returns favorites for authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockOrder.mockResolvedValue({
      data: [{ game_id: 'bgg-13', created_at: '2024-01-01', games: { name: 'Catan' } }],
      error: null,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.favorites).toHaveLength(1);
    expect(data.favorites[0].game_id).toBe('bgg-13');
  });
});

describe('POST /api/favorites', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = new NextRequest('http://localhost/api/favorites', {
      method: 'POST',
      body: JSON.stringify({ gameId: 'bgg-13' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when gameId is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const request = new NextRequest('http://localhost/api/favorites', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
