/**
 * Tests for the Redis cache layer.
 *
 * REDIS_DISABLED is now controlled by env var (defaults to enabled).
 * With mocked env vars providing URL + token, Redis is active and
 * operations delegate to the mock client.
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

// Set env vars so Redis client is created (REDIS_DISABLED not set = enabled)
vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io');
vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');

import { redisCache } from './redis';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Enabled mode (default when env vars present) ────────────

describe('redisCache (enabled mode)', () => {
  it('get calls Redis and returns data', async () => {
    mockGet.mockResolvedValue({ games: ['a'] });
    const data = await redisCache.get('test-key');
    expect(data).toEqual({ games: ['a'] });
    expect(mockGet).toHaveBeenCalledWith('test-key');
  });

  it('get returns null on cache miss', async () => {
    mockGet.mockResolvedValue(null);
    const data = await redisCache.get('missing-key');
    expect(data).toBeNull();
  });

  it('get returns null on Redis error', async () => {
    mockGet.mockRejectedValue(new Error('Redis down'));
    const data = await redisCache.get('key');
    expect(data).toBeNull();
  });

  it('set calls Redis with TTL', async () => {
    mockSet.mockResolvedValue('OK');
    await redisCache.set('key', { data: 'test' }, 60);
    expect(mockSet).toHaveBeenCalledWith('key', { data: 'test' }, { ex: 60 });
  });

  it('set does not throw on Redis error', async () => {
    mockSet.mockRejectedValue(new Error('Redis down'));
    await expect(redisCache.set('key', 'value', 60)).resolves.toBeUndefined();
  });

  it('del calls Redis', async () => {
    mockDel.mockResolvedValue(1);
    await redisCache.del('key');
    expect(mockDel).toHaveBeenCalledWith('key');
  });

  it('del does not throw on Redis error', async () => {
    mockDel.mockRejectedValue(new Error('Redis down'));
    await expect(redisCache.del('key')).resolves.toBeUndefined();
  });

  it('isAvailable returns true', () => {
    expect(redisCache.isAvailable()).toBe(true);
  });
});
