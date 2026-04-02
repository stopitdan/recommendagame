/**
 * Tests for eval metrics.
 *
 * Verifies mathematical correctness of NDCG, MAP, MRR, ILD, Novelty
 * against hand-computed expected values from the academic formulas.
 */

import { describe, it, expect } from 'vitest';
import {
  ndcgAtK,
  averagePrecisionAtK,
  reciprocalRank,
  hitRateAtK,
  precisionAtK,
  recallAtK,
  ildAtK,
  noveltyAtK,
  computeQueryMetrics,
  averageMetrics,
  type GradedResult,
} from './eval-metrics';

// Helper to make GradedResult objects quickly
function r(relevance: 0 | 1 | 2 | 3, tags?: string[], ratingCount?: number): GradedResult {
  return {
    gameId: `game-${Math.random()}`,
    gameName: `Game ${relevance}`,
    relevance,
    tags,
    ratingCount,
  };
}

describe('NDCG@K', () => {
  it('returns 1.0 for perfect ranking', () => {
    // Results already in ideal order: 3, 2, 1, 0
    const results = [r(3), r(2), r(1), r(0)];
    expect(ndcgAtK(results, 4)).toBeCloseTo(1.0, 4);
  });

  it('returns < 1.0 for suboptimal ranking', () => {
    // Worst relevant item first: 0, 0, 0, 3
    const results = [r(0), r(0), r(0), r(3)];
    expect(ndcgAtK(results, 4)).toBeLessThan(1.0);
    expect(ndcgAtK(results, 4)).toBeGreaterThan(0);
  });

  it('returns 0 when no relevant items exist', () => {
    const results = [r(0), r(0), r(0)];
    expect(ndcgAtK(results, 3)).toBe(0);
  });

  it('hand-computed example matches formula', () => {
    // Results: [3, 0, 2, 1, 0]
    // DCG = 3/log2(2) + 0/log2(3) + 2/log2(4) + 1/log2(5) + 0/log2(6)
    //     = 3/1 + 0 + 2/2 + 1/2.322 + 0 = 3 + 0 + 1 + 0.4307 = 4.4307
    // Ideal: [3, 2, 1, 0, 0]
    // IDCG = 3/1 + 2/1.585 + 1/2 + 0 + 0 = 3 + 1.2619 + 0.5 = 4.7619
    // NDCG = 4.4307 / 4.7619 = 0.9304
    const results = [r(3), r(0), r(2), r(1), r(0)];
    expect(ndcgAtK(results, 5)).toBeCloseTo(0.9304, 3);
  });

  it('respects K parameter', () => {
    const results = [r(0), r(0), r(3), r(3)];
    // At K=2, only sees [0, 0] -> NDCG = 0
    expect(ndcgAtK(results, 2)).toBe(0);
    // At K=4, sees the 3s -> NDCG > 0
    expect(ndcgAtK(results, 4)).toBeGreaterThan(0);
  });
});

describe('MAP@K', () => {
  it('returns 1.0 for perfect ranking', () => {
    // All relevant items at top
    const results = [r(3), r(2), r(1), r(0), r(0)];
    // 3 relevant items, all in top 3
    // AP = (1/3) * (1/1 + 2/2 + 3/3) = (1/3) * 3 = 1.0
    expect(averagePrecisionAtK(results, 5, 3)).toBeCloseTo(1.0, 4);
  });

  it('returns lower for scattered relevant items', () => {
    // Relevant items at positions 1, 3, 5
    const results = [r(2), r(0), r(1), r(0), r(3)];
    // AP = (1/3) * (1/1 + 2/3 + 3/5) = (1/3) * (1 + 0.667 + 0.6) = (1/3) * 2.267 = 0.756
    expect(averagePrecisionAtK(results, 5, 3)).toBeCloseTo(0.756, 2);
  });

  it('returns 0 when no relevant items', () => {
    const results = [r(0), r(0), r(0)];
    expect(averagePrecisionAtK(results, 3, 0)).toBe(0);
  });
});

describe('MRR', () => {
  it('returns 1.0 when first item is relevant', () => {
    const results = [r(3), r(0), r(0)];
    expect(reciprocalRank(results)).toBe(1.0);
  });

  it('returns 0.5 when second item is first relevant', () => {
    const results = [r(0), r(2), r(0)];
    expect(reciprocalRank(results)).toBe(0.5);
  });

  it('returns 0 when no relevant items', () => {
    const results = [r(0), r(0), r(0)];
    expect(reciprocalRank(results)).toBe(0);
  });

  it('treats relevance >= 1 as relevant', () => {
    const results = [r(0), r(0), r(1)]; // grade 1 = partially relevant
    expect(reciprocalRank(results)).toBeCloseTo(1 / 3, 4);
  });
});

describe('HitRate@K', () => {
  it('returns 1 when relevant item exists in top K', () => {
    const results = [r(0), r(0), r(2), r(0), r(0)];
    expect(hitRateAtK(results, 5)).toBe(1);
  });

  it('returns 0 when no relevant item in top K', () => {
    const results = [r(0), r(0), r(0), r(0), r(3)];
    expect(hitRateAtK(results, 4)).toBe(0); // K=4 misses the 3 at position 5
  });
});

describe('Precision@K', () => {
  it('returns correct fraction', () => {
    const results = [r(3), r(0), r(2), r(0), r(1)];
    // 3 relevant out of 5
    expect(precisionAtK(results, 5)).toBeCloseTo(0.6, 4);
  });

  it('returns 0 for all irrelevant', () => {
    const results = [r(0), r(0), r(0)];
    expect(precisionAtK(results, 3)).toBe(0);
  });

  it('returns 1.0 for all relevant', () => {
    const results = [r(3), r(2), r(1)];
    expect(precisionAtK(results, 3)).toBeCloseTo(1.0, 4);
  });
});

describe('Recall@K', () => {
  it('returns correct fraction', () => {
    const results = [r(3), r(0), r(2), r(0), r(0)];
    // 2 relevant in top 5, 4 total relevant
    expect(recallAtK(results, 5, 4)).toBeCloseTo(0.5, 4);
  });

  it('returns 1.0 when all relevant found', () => {
    const results = [r(3), r(2), r(0)];
    expect(recallAtK(results, 3, 2)).toBeCloseTo(1.0, 4);
  });

  it('returns 0 when none found', () => {
    const results = [r(0), r(0)];
    expect(recallAtK(results, 2, 5)).toBe(0);
  });
});

describe('ILD@K (diversity)', () => {
  it('returns 0 for identical tag sets', () => {
    const tags = ['Strategy', 'Economic'];
    const results = [r(3, tags), r(2, tags), r(1, tags)];
    expect(ildAtK(results, 3)).toBe(0);
  });

  it('returns 1.0 for completely disjoint tag sets', () => {
    const results = [
      r(3, ['Strategy', 'Economic']),
      r(2, ['Horror', 'Adventure']),
    ];
    // Jaccard distance = 1 - 0/4 = 1.0
    expect(ildAtK(results, 2)).toBeCloseTo(1.0, 4);
  });

  it('returns intermediate value for partial overlap', () => {
    const results = [
      r(3, ['Strategy', 'Economic', 'Medieval']),
      r(2, ['Strategy', 'Adventure', 'Fantasy']),
    ];
    // Intersection: {Strategy} = 1
    // Union: {Strategy, Economic, Medieval, Adventure, Fantasy} = 5
    // Jaccard = 1/5, Distance = 1 - 0.2 = 0.8
    expect(ildAtK(results, 2)).toBeCloseTo(0.8, 4);
  });

  it('handles empty tag sets gracefully', () => {
    const results = [r(3), r(2)]; // no tags
    expect(ildAtK(results, 2)).toBe(0);
  });
});

describe('Novelty@K', () => {
  it('returns higher novelty for less popular items', () => {
    const popular = [r(3, [], 100000), r(2, [], 50000)];
    const niche = [r(3, [], 100), r(2, [], 50)];
    const maxRating = 100000;

    const popularNovelty = noveltyAtK(popular, 2, maxRating);
    const nicheNovelty = noveltyAtK(niche, 2, maxRating);

    expect(nicheNovelty).toBeGreaterThan(popularNovelty);
  });

  it('returns 0 when all items have max popularity', () => {
    const results = [r(3, [], 100000), r(2, [], 100000)];
    // -log2(1.0) = 0
    expect(noveltyAtK(results, 2, 100000)).toBe(0);
  });
});

describe('computeQueryMetrics', () => {
  it('computes all metrics together', () => {
    const results = [
      r(3, ['Strategy'], 50000),
      r(0, ['Party'], 100000),
      r(2, ['Strategy', 'Economic'], 1000),
      r(1, ['Adventure'], 500),
    ];

    const metrics = computeQueryMetrics(results, 4, 3, 100000);

    expect(metrics.ndcg).toBeGreaterThan(0);
    expect(metrics.map).toBeGreaterThan(0);
    expect(metrics.mrr).toBe(1.0); // first item is relevant
    expect(metrics.hitRate).toBe(1);
    expect(metrics.precision).toBeCloseTo(0.75, 4); // 3/4 relevant
    expect(metrics.ild).toBeGreaterThan(0); // tags differ
    expect(metrics.novelty).toBeGreaterThan(0);
  });
});

describe('averageMetrics', () => {
  it('averages correctly', () => {
    const m1: any = {
      ndcg: 0.8, map: 0.6, mrr: 1.0, hitRate: 1,
      precision: 0.5, recall: 0.4, ild: 0.7, novelty: 5.0,
      constraintViolationRate: 0.1,
    };
    const m2: any = {
      ndcg: 0.4, map: 0.2, mrr: 0.5, hitRate: 1,
      precision: 0.3, recall: 0.2, ild: 0.5, novelty: 3.0,
      constraintViolationRate: 0.3,
    };

    const avg = averageMetrics([m1, m2]);
    expect(avg.ndcg).toBeCloseTo(0.6, 4);
    expect(avg.map).toBeCloseTo(0.4, 4);
    expect(avg.mrr).toBeCloseTo(0.75, 4);
    expect(avg.constraintViolationRate).toBeCloseTo(0.2, 4);
  });

  it('returns zeros for empty array', () => {
    const avg = averageMetrics([]);
    expect(avg.ndcg).toBe(0);
    expect(avg.map).toBe(0);
  });
});
