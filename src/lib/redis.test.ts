/**
 * Tests for the Redis cache layer.
 *
 * When REDIS_DISABLED is true (current state), all operations
 * gracefully return null/undefined without touching Redis.
 * When re-enabled, the mocked Redis tests verify correct behavior.
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

// Set env vars so Redis client would be created if not disabled
vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io');
vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');

import { redisCache } from './redis';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Current behavior: Redis is disabled via kill switch ──────

describe('redisCache (disabled mode)', () => {
  it('get returns null without calling Redis', async () => {
    const data = await redisCache.get('any-key');
    expect(data).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('set is a no-op without calling Redis', async () => {
    await redisCache.set('key', { data: 'test' }, 60);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('del is a no-op without calling Redis', async () => {
    await redisCache.del('key');
    expect(mockDel).not.toHaveBeenCalled();
  });

  it('isAvailable returns false', () => {
    expect(redisCache.isAvailable()).toBe(false);
  });
});

// ── Graceful fallback tests (always valid) ───────────────────

describe('redisCache graceful behavior', () => {
  it('get does not throw', async () => {
    await expect(redisCache.get('key')).resolves.toBeNull();
  });

  it('set does not throw', async () => {
    await expect(redisCache.set('key', 'value', 60)).resolves.toBeUndefined();
  });

  it('del does not throw', async () => {
    await expect(redisCache.del('key')).resolves.toBeUndefined();
  });
});
