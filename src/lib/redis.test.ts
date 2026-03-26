/**
 * Tests for the Redis cache layer.
 *
 * Validates graceful fallback when Redis is unavailable
 * and correct behavior with mocked Redis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @upstash/redis
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();

vi.mock('@upstash/redis', () => {
  return {
    Redis: class MockRedis {
      get = mockGet;
      set = mockSet;
      del = mockDel;
    },
  };
});

// Set env vars so Redis client gets created
vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io');
vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');

import { redisCache } from './redis';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('redisCache.get', () => {
  it('returns cached data on hit', async () => {
    mockGet.mockResolvedValue({ results: [{ id: 'bgg-1' }] });

    const data = await redisCache.get<{ results: unknown[] }>('test-key');
    expect(data).toEqual({ results: [{ id: 'bgg-1' }] });
    expect(mockGet).toHaveBeenCalledWith('test-key');
  });

  it('returns null on cache miss', async () => {
    mockGet.mockResolvedValue(null);

    const data = await redisCache.get('missing-key');
    expect(data).toBeNull();
  });

  it('returns null on error (graceful fallback)', async () => {
    mockGet.mockRejectedValue(new Error('connection refused'));

    const data = await redisCache.get('error-key');
    expect(data).toBeNull();
  });
});

describe('redisCache.set', () => {
  it('sets a value with TTL', async () => {
    mockSet.mockResolvedValue('OK');

    await redisCache.set('key', { data: 'test' }, 60);
    expect(mockSet).toHaveBeenCalledWith('key', { data: 'test' }, { ex: 60 });
  });

  it('does not throw on error', async () => {
    mockSet.mockRejectedValue(new Error('write error'));

    await expect(redisCache.set('key', 'value', 60)).resolves.toBeUndefined();
  });
});

describe('redisCache.del', () => {
  it('deletes a key', async () => {
    mockDel.mockResolvedValue(1);

    await redisCache.del('key');
    expect(mockDel).toHaveBeenCalledWith('key');
  });

  it('does not throw on error', async () => {
    mockDel.mockRejectedValue(new Error('delete error'));

    await expect(redisCache.del('key')).resolves.toBeUndefined();
  });
});

describe('redisCache.isAvailable', () => {
  it('returns true when env vars are set', () => {
    expect(redisCache.isAvailable()).toBe(true);
  });
});
