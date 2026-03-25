/**
 * Tests for the leaderboard API route.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockGt = vi.fn();
const mockNot = vi.fn();
const mockContains = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

import { GET } from './route';
import { NextRequest } from 'next/server';

beforeEach(() => {
  vi.clearAllMocks();

  // Build the chain: from().select().not().gt().order().limit()
  // The chain also supports .contains() for type filtering, which can appear after .gt()
  // The Supabase query builder chains and each returns an object with all methods.
  // When type filter is used: from().select().not().gt().order().limit().contains()
  // The final .contains() or the builder itself resolves to { data, error } via await.
  const chainObj: Record<string, unknown> = {};
  mockContains.mockImplementation(() => Promise.resolve({ data: [{ id: 'bgg-1', name: 'Catan', rating: 8.5 }], error: null }));
  mockLimit.mockReturnValue({ ...chainObj, contains: mockContains, then: (resolve: (v: unknown) => void) => resolve({ data: [{ id: 'bgg-1', name: 'Catan', rating: 8.5 }], error: null }) });
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockGt.mockReturnValue({ order: mockOrder });
  mockNot.mockReturnValue({ gt: mockGt });
  mockSelect.mockReturnValue({ not: mockNot });
  mockFrom.mockReturnValue({ select: mockSelect });
});

describe('GET /api/leaderboard', () => {
  it('returns top games with default limit of 25', async () => {
    const req = new NextRequest('http://localhost/api/leaderboard');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.games).toBeDefined();
    expect(body.type).toBe('all');
    expect(mockLimit).toHaveBeenCalledWith(25);
  });

  it('filters by type when provided', async () => {
    // Need to add contains to the chain
    mockContains.mockReturnValue({ order: mockOrder });
    mockGt.mockReturnValue({ order: mockOrder, contains: mockContains });
    mockNot.mockReturnValue({ gt: mockGt });

    const req = new NextRequest('http://localhost/api/leaderboard?type=board');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.type).toBe('board');
  });

  it('respects custom limit capped at 100', async () => {
    const req = new NextRequest('http://localhost/api/leaderboard?limit=50');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('caps limit at 100', async () => {
    const req = new NextRequest('http://localhost/api/leaderboard?limit=500');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockLimit).toHaveBeenCalledWith(100);
  });

  it('returns 500 on database error', async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const req = new NextRequest('http://localhost/api/leaderboard');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('DB error');
  });
});
