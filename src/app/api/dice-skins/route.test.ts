/**
 * Tests for dice skins list/create API routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockOrder = vi.fn();
const mockEq = vi.fn(() => ({ order: mockOrder }));
const mockSelectList = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn((table: string) => {
  if (table === 'custom_dice_skins') {
    return { select: mockSelectList, insert: mockInsert };
  }
  return {};
});

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
});

describe('GET /api/dice-skins', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns empty array when no custom skins exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockOrder.mockResolvedValue({ data: [], error: null });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.skins).toEqual([]);
  });

  it('returns 500 on database error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockOrder.mockResolvedValue({ data: null, error: { message: 'db error' } });

    const response = await GET();
    expect(response.status).toBe(500);
  });
});

describe('POST /api/dice-skins', () => {
  function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/dice-skins', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validBody = {
    name: 'My Custom Die',
    emoji: '🔥',
    config: {
      baseType: 'solid',
      body: '#FF0000',
      accent: '#00FF00',
      label: '#FFFFFF',
      labelShadow: 'rgba(0,0,0,0.5)',
      metalness: 0.5,
      roughness: 0.3,
      labelStyle: 'numbers',
    },
    is_public: false,
  };

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(401);
  });

  it('returns 400 for empty name', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const response = await POST(makeRequest({ ...validBody, name: '' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 for name over 50 chars', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const response = await POST(makeRequest({ ...validBody, name: 'a'.repeat(51) }));
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid config', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const response = await POST(makeRequest({ ...validBody, config: { baseType: 'invalid' } }));
    expect(response.status).toBe(400);
  });

  it('creates skin and returns ID on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSingle.mockResolvedValue({ data: { id: 'new-uuid-123' }, error: null });

    const response = await POST(makeRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('new-uuid-123');
  });

  it('returns 500 on database error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSingle.mockResolvedValue({ data: null, error: { message: 'db error' } });

    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(500);
  });
});
