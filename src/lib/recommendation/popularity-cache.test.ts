/**
 * Tests for the popularity cache module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis — must use factory pattern without external refs
vi.mock('@/lib/redis', () => {
  const mockGet = vi.fn().mockResolvedValue(null);
  return {
    redisCache: {
      get: mockGet,
      set: vi.fn(),
      del: vi.fn(),
      isAvailable: vi.fn().mockReturnValue(true),
    },
    __mockGet: mockGet,
  };
});

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

import { getPopularFallback } from './popularity-cache';
import * as redisModule from '@/lib/redis';

// Access mock internals
const mockGet = (redisModule as unknown as { __mockGet: ReturnType<typeof vi.fn> }).__mockGet;

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(null);
});

describe('getPopularFallback', () => {
  it('returns player bracket list when player count specified', async () => {
    const mockGames = [{ id: 'bgg-1', name: 'Two Player Game' }];
    mockGet.mockImplementation((key: string) => {
      if (key === 'pop:players:2') return Promise.resolve(mockGames);
      return Promise.resolve(null);
    });

    const result = await getPopularFallback({
      playerCount: { min: 2, max: 2 },
    });

    expect(result).toEqual(mockGames);
  });

  it('falls back to type list when player bracket empty', async () => {
    const mockGames = [{ id: 'bgg-2', name: 'Board Game' }];
    mockGet.mockImplementation((key: string) => {
      if (key === 'pop:type:board') return Promise.resolve(mockGames);
      return Promise.resolve(null);
    });

    const result = await getPopularFallback({
      playerCount: { min: 2, max: 2 },
      gameTypes: ['board'],
    });

    expect(result).toEqual(mockGames);
  });

  it('falls back to category list when type empty', async () => {
    const mockGames = [{ id: 'bgg-3', name: 'Strategy Game' }];
    mockGet.mockImplementation((key: string) => {
      if (key === 'pop:cat:Strategy') return Promise.resolve(mockGames);
      return Promise.resolve(null);
    });

    const result = await getPopularFallback({
      genres: ['Strategy'],
    });

    expect(result).toEqual(mockGames);
  });

  it('falls back to overall list as last resort', async () => {
    const mockGames = [{ id: 'bgg-4', name: 'Popular Game' }];
    mockGet.mockImplementation((key: string) => {
      if (key === 'pop:overall') return Promise.resolve(mockGames);
      return Promise.resolve(null);
    });

    const result = await getPopularFallback({});

    expect(result).toEqual(mockGames);
  });

  it('returns empty array when all caches miss', async () => {
    const result = await getPopularFallback({});
    expect(result).toEqual([]);
  });
});
