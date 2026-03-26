/**
 * Tests for the feedback API route.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase auth + db
const mockGetUser = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({ upsert: mockUpsert });
});

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/feedback', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const response = await POST(makeRequest({ gameId: 'bgg-1', rating: -1 }) as any);
    expect(response.status).toBe(401);
  });

  it('returns 400 for missing gameId', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const response = await POST(makeRequest({ rating: -1 }) as any);
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid rating', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const response = await POST(makeRequest({ gameId: 'bgg-1', rating: 5 }) as any);
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const response = await POST(new Request('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }) as any);
    expect(response.status).toBe(400);
  });

  it('upserts feedback with rating -1 (thumbs down)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockUpsert.mockResolvedValue({ error: null });

    const response = await POST(makeRequest({ gameId: 'bgg-1', rating: -1 }) as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('user_game_feedback');
    expect(mockUpsert).toHaveBeenCalledWith(
      { user_id: 'user-1', game_id: 'bgg-1', rating: -1, context: 'results' },
      { onConflict: 'user_id,game_id' },
    );
  });

  it('upserts feedback with rating 1 (thumbs up)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockUpsert.mockResolvedValue({ error: null });

    const response = await POST(makeRequest({ gameId: 'bgg-1', rating: 1, context: 'results' }) as any);
    expect(response.status).toBe(200);
  });

  it('returns 500 on DB error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockUpsert.mockResolvedValue({ error: { message: 'DB error' } });

    const response = await POST(makeRequest({ gameId: 'bgg-1', rating: -1 }) as any);
    expect(response.status).toBe(500);
  });
});
