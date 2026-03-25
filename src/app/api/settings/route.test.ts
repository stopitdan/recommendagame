/**
 * Tests for settings API routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpsert = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect, upsert: mockUpsert }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import { GET, PUT } from './route';
import { NextRequest } from 'next/server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/settings', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns defaults when no preferences row exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.settings.popularity_mode).toBe('popular');
    expect(data.settings.min_rating).toBe(0);
    expect(data.settings.excluded_sources).toEqual([]);
  });

  it('returns saved settings', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSingle.mockResolvedValue({
      data: { popularity_mode: 'hidden-gems', min_rating: 7, excluded_sources: ['local'] },
      error: null,
    });

    const response = await GET();
    const data = await response.json();

    expect(data.settings.popularity_mode).toBe('hidden-gems');
    expect(data.settings.min_rating).toBe(7);
    expect(data.settings.excluded_sources).toEqual(['local']);
  });
});

describe('PUT /api/settings', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = new NextRequest('http://localhost/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ popularity_mode: 'any' }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(401);
  });
});
