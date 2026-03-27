/**
 * Tests for single dice skin CRUD API routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockEqChain = vi.fn(() => ({ single: mockSingle }));
const mockEq = vi.fn(() => ({ eq: mockEqChain, single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpdateEq2 = vi.fn();
const mockUpdateEq = vi.fn(() => ({ eq: mockUpdateEq2 }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockDeleteEq2 = vi.fn();
const mockDeleteEq = vi.fn(() => ({ eq: mockDeleteEq2 }));
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
  delete: mockDelete,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import { GET, PUT, DELETE } from './route';
import { NextRequest } from 'next/server';

const validUuid = '550e8400-e29b-41d4-a716-446655440000';

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/dice-skins/${validUuid}`, {
    method,
    ...(body ? {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/dice-skins/[id]', () => {
  it('returns 400 for non-UUID ID', async () => {
    const response = await GET(makeRequest('GET'), makeContext('classic-purple'));
    expect(response.status).toBe(400);
  });

  it('returns 404 when skin not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const response = await GET(makeRequest('GET'), makeContext(validUuid));
    expect(response.status).toBe(404);
  });

  it('returns skin data on success', async () => {
    mockSingle.mockResolvedValue({
      data: { id: validUuid, name: 'Test Skin', config: {} },
      error: null,
    });
    const response = await GET(makeRequest('GET'), makeContext(validUuid));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.skin.name).toBe('Test Skin');
  });
});

describe('PUT /api/dice-skins/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await PUT(makeRequest('PUT', { name: 'New Name' }), makeContext(validUuid));
    expect(response.status).toBe(401);
  });

  it('returns 400 for empty update', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const response = await PUT(makeRequest('PUT', {}), makeContext(validUuid));
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid name', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const response = await PUT(makeRequest('PUT', { name: '' }), makeContext(validUuid));
    expect(response.status).toBe(400);
  });

  it('updates skin on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockUpdateEq2.mockResolvedValue({ error: null });
    const response = await PUT(makeRequest('PUT', { name: 'Updated' }), makeContext(validUuid));
    expect(response.status).toBe(200);
  });
});

describe('DELETE /api/dice-skins/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await DELETE(makeRequest('DELETE'), makeContext(validUuid));
    expect(response.status).toBe(401);
  });

  it('deletes skin on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockDeleteEq2.mockResolvedValue({ error: null });
    const response = await DELETE(makeRequest('DELETE'), makeContext(validUuid));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
