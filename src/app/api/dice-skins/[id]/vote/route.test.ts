/**
 * Tests for dice skin vote toggle API route.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockVoteSingle = vi.fn();
const mockVoteEqSkinId = vi.fn(() => ({ single: mockVoteSingle }));
const mockVoteEqUserId = vi.fn(() => ({ eq: mockVoteEqSkinId }));
const mockVoteSelect = vi.fn(() => ({ eq: mockVoteEqUserId }));
const mockInsert = vi.fn();
const mockDeleteEq2 = vi.fn();
const mockDeleteEq = vi.fn(() => ({ eq: mockDeleteEq2 }));
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));
const mockSkinSingle = vi.fn();
const mockSkinEq = vi.fn(() => ({ single: mockSkinSingle }));
const mockSkinSelect = vi.fn(() => ({ eq: mockSkinEq }));

const mockFrom = vi.fn((table: string) => {
  if (table === 'custom_dice_votes') {
    return {
      select: mockVoteSelect,
      insert: mockInsert,
      delete: mockDelete,
    };
  }
  if (table === 'custom_dice_skins') {
    return { select: mockSkinSelect };
  }
  return {};
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import { POST } from './route';
import { NextRequest } from 'next/server';

const validUuid = '550e8400-e29b-41d4-a716-446655440000';

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest() {
  return new NextRequest(`http://localhost/api/dice-skins/${validUuid}/vote`, {
    method: 'POST',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/dice-skins/[id]/vote', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(makeRequest(), makeContext(validUuid));
    expect(response.status).toBe(401);
  });

  it('returns 400 for non-UUID ID', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const response = await POST(makeRequest(), makeContext('not-a-uuid'));
    expect(response.status).toBe(400);
  });

  it('adds vote when no existing vote', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockVoteSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    mockInsert.mockResolvedValue({ error: null });
    mockSkinSingle.mockResolvedValue({ data: { vote_count: 5 } });

    const response = await POST(makeRequest(), makeContext(validUuid));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.voted).toBe(true);
    expect(data.vote_count).toBe(5);
  });

  it('removes vote when existing vote found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockVoteSingle.mockResolvedValue({ data: { id: 1 }, error: null });
    mockDeleteEq2.mockResolvedValue({ error: null });
    mockSkinSingle.mockResolvedValue({ data: { vote_count: 3 } });

    const response = await POST(makeRequest(), makeContext(validUuid));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.voted).toBe(false);
    expect(data.vote_count).toBe(3);
  });
});
