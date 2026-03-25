/**
 * Tests for collaborative filtering.
 *
 * Since CF depends heavily on DB state, these tests focus on
 * the logic with mocked Supabase responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'eq', 'neq', 'in', 'gte', 'single'];
  for (const m of methods) {
    chain[m] = vi.fn();
  }
  for (const fn of Object.values(chain)) {
    fn.mockReturnValue(chain);
  }

  const mockFrom = vi.fn().mockReturnValue(chain);

  return {
    createClient: vi.fn().mockReturnValue({ from: mockFrom }),
    __chain: chain,
    __from: mockFrom,
  };
});

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

import { getItemBasedRecommendations, getCollaborativeSignals } from './collaborative';
import * as supa from '@supabase/supabase-js';

const { __chain: chain } = supa as unknown as {
  __chain: Record<string, ReturnType<typeof vi.fn>>;
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(chain)) {
    fn.mockReturnValue(chain);
  }
});

describe('getItemBasedRecommendations', () => {
  it('returns empty array for empty liked games', async () => {
    const result = await getItemBasedRecommendations([]);
    expect(result).toEqual([]);
  });

  it('returns empty array when not enough feedback data', async () => {
    // First call: count check (not enough data)
    chain.select.mockResolvedValueOnce({ count: 3, error: null });

    const result = await getItemBasedRecommendations(['game-1']);
    expect(result).toEqual([]);
  });
});

describe('getCollaborativeSignals', () => {
  it('returns empty map when no user and no liked games', async () => {
    const signals = await getCollaborativeSignals(null, []);
    expect(signals.size).toBe(0);
  });
});
