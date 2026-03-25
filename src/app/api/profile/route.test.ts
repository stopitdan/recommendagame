/**
 * Tests for GET /api/profile
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock('@/lib/supabase/games', () => ({
  rowToGame: (row: any) => ({
    id: row.id,
    name: row.name,
    source: row.source,
    sourceId: row.source_id,
    types: row.types ?? [],
    categories: row.categories ?? [],
    mechanics: row.mechanics ?? [],
    themes: row.themes ?? [],
    platforms: row.platforms ?? [],
    description: row.description ?? '',
  }),
}));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/profile', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns profile data for authenticated user', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          user_metadata: { display_name: 'Test User' },
        },
      },
    });

    // Mock favorites query
    const favChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ game_id: 'game-1' }, { game_id: 'game-2' }],
            error: null,
          }),
        }),
      }),
    };

    // Mock reviews query
    const reviewChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 1, game_id: 'game-1', rating: 8, review_text: 'Great!', created_at: '2024-01-01' }],
              error: null,
            }),
          }),
        }),
      }),
    };

    // Mock presets query
    const presetChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ id: 1, name: 'Game Night', created_at: '2024-01-01' }],
            error: null,
          }),
        }),
      }),
    };

    // Mock games lookup (for favorites and review names)
    const gamesChain = {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            { id: 'game-1', name: 'Catan', source: 'bgg', source_id: '1', types: ['board'], categories: [], mechanics: [], themes: [], platforms: [], description: '' },
            { id: 'game-2', name: 'Pandemic', source: 'bgg', source_id: '2', types: ['board'], categories: [], mechanics: [], themes: [], platforms: [], description: '' },
          ],
          error: null,
        }),
      }),
    };

    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_favorites') return favChain;
      if (table === 'user_reviews') return reviewChain;
      if (table === 'user_saved_presets') return presetChain;
      if (table === 'games') return gamesChain;
      return gamesChain;
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.email).toBe('test@example.com');
    expect(data.displayName).toBe('Test User');
    expect(data.favoriteCount).toBe(2);
    expect(data.reviewCount).toBe(1);
    expect(data.presetCount).toBe(1);
    expect(data.favorites).toHaveLength(2);
    expect(data.recentReviews[0].game_name).toBe('Catan');
  });
});
