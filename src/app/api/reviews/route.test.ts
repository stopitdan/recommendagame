/**
 * Tests for reviews API routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockEq.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert });
});

describe('GET /api/reviews', () => {
  it('returns 400 without gameId', async () => {
    const request = new NextRequest('http://localhost/api/reviews');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('returns reviews for a game', async () => {
    mockOrder.mockResolvedValue({
      data: [{ id: 1, rating: 8, review_text: 'Great game!', created_at: '2024-01-01' }],
      error: null,
    });

    const request = new NextRequest('http://localhost/api/reviews?gameId=bgg-13');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reviews).toHaveLength(1);
  });
});

describe('POST /api/reviews', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = new NextRequest('http://localhost/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ gameId: 'bgg-13', rating: 8 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid rating', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const request = new NextRequest('http://localhost/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ gameId: 'bgg-13', rating: 15 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 without gameId', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const request = new NextRequest('http://localhost/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ rating: 8 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
