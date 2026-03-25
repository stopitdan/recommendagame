/**
 * Tests for reviews API routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

// Separate chains for different tables
const reviewsChain = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  upsert: vi.fn(),
};

const profilesChain = {
  select: vi.fn(),
  in: vi.fn(),
};

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

  // Default: reviews chain
  reviewsChain.order.mockResolvedValue({ data: [], error: null });
  reviewsChain.eq.mockReturnValue({ order: reviewsChain.order });
  reviewsChain.select.mockReturnValue({ eq: reviewsChain.eq });
  reviewsChain.upsert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
    }),
  });

  // Default: profiles chain
  profilesChain.in.mockResolvedValue({ data: [], error: null });
  profilesChain.select.mockReturnValue({ in: profilesChain.in });

  // Route from() to the right chain based on table name
  mockFrom.mockImplementation((table: string) => {
    if (table === 'user_profiles') return profilesChain;
    return reviewsChain;
  });
});

describe('GET /api/reviews', () => {
  it('returns 400 without gameId', async () => {
    const request = new NextRequest('http://localhost/api/reviews');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it('returns reviews for a game', async () => {
    reviewsChain.order.mockResolvedValue({
      data: [{ id: 1, user_id: 'u1', rating: 8, review_text: 'Great game!', created_at: '2024-01-01' }],
      error: null,
    });
    profilesChain.in.mockResolvedValue({
      data: [{ id: 'u1', display_name: 'Alice' }],
      error: null,
    });

    const request = new NextRequest('http://localhost/api/reviews?gameId=bgg-13');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reviews).toHaveLength(1);
    expect(data.reviews[0].user_profiles.display_name).toBe('Alice');
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
