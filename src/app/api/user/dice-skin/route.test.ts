/**
 * Tests for dice skin API routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate }));

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

describe('GET /api/user/dice-skin', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns default skin when no preference exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.skinId).toBe('classic-purple');
  });

  it('returns saved skin preference', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSingle.mockResolvedValue({ data: { dice_skin: 'inferno' }, error: null });

    const response = await GET();
    const data = await response.json();

    expect(data.skinId).toBe('inferno');
  });

  it('returns default when dice_skin is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSingle.mockResolvedValue({ data: { dice_skin: null }, error: null });

    const response = await GET();
    const data = await response.json();

    expect(data.skinId).toBe('classic-purple');
  });
});

describe('PUT /api/user/dice-skin', () => {
  function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/user/dice-skin', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await PUT(makeRequest({ skinId: 'inferno' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid skin ID', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const response = await PUT(makeRequest({ skinId: 'fake-skin' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 for missing skinId', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const response = await PUT(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it('returns 400 for non-string skinId', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const response = await PUT(makeRequest({ skinId: 42 }));
    expect(response.status).toBe(400);
  });

  it('saves valid skin and returns it', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockUpdateEq.mockResolvedValue({ error: null });

    const response = await PUT(makeRequest({ skinId: 'deep-ocean' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.skinId).toBe('deep-ocean');
    expect(mockFrom).toHaveBeenCalledWith('user_preferences');
    expect(mockUpdate).toHaveBeenCalledWith({ dice_skin: 'deep-ocean' });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('returns 500 on database error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockUpdateEq.mockResolvedValue({ error: { message: 'db error' } });

    const response = await PUT(makeRequest({ skinId: 'inferno' }));
    expect(response.status).toBe(500);
  });
});
