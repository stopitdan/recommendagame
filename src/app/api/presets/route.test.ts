/**
 * Tests for saved presets API routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockSingle = vi.fn();
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

  // Default chain for GET: from().select().eq().order()
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockEq.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq });

  // Default chain for POST: from().insert().select().single()
  mockSingle.mockResolvedValue({ data: { id: 1, name: 'My Preset' }, error: null });
  mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });

  mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
});

describe('GET /api/presets', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Not authenticated');
  });

  it('returns user presets when authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockOrder.mockResolvedValue({
      data: [{ id: 1, name: 'Game Night', preferences: { type: 'board' } }],
      error: null,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.presets).toHaveLength(1);
    expect(body.presets[0].name).toBe('Game Night');
  });

  it('returns 500 on database error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('DB error');
  });
});

describe('POST /api/presets', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new NextRequest('http://localhost/api/presets', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', preferences: {} }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const req = new NextRequest('http://localhost/api/presets', {
      method: 'POST',
      body: JSON.stringify({ preferences: { type: 'board' } }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Missing name or preferences');
  });

  it('returns 400 when preferences is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const req = new NextRequest('http://localhost/api/presets', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Preset' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates a preset and returns 201', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const req = new NextRequest('http://localhost/api/presets', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Game Night',
        preferences: { type: 'board', playerCount: [2, 4] },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.preset).toBeDefined();
    expect(body.preset.name).toBe('My Preset');
  });

  it('returns 500 on database error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

    const req = new NextRequest('http://localhost/api/presets', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', preferences: {} }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Insert failed');
  });
});
