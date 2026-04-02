/**
 * Recommendation System Evaluation Metrics
 *
 * Implements research-standard IR metrics for evaluating ranked recommendation lists.
 * Based on: Microsoft Recommenders library, MTEB benchmark, RecSys conference standards.
 *
 * All formulas from:
 * - NDCG: Jarvelin & Kekalainen (2002) "Cumulated Gain-Based Evaluation of IR Techniques"
 * - MAP: Manning, Raghavan, Schutze (2008) "Introduction to Information Retrieval"
 * - MRR: Voorhees (1999) "The TREC-8 Question Answering Track Report"
 * - ILD: Ziegler et al. (2005) "Improving Recommendation Lists Through Topic Diversification"
 */

// ─── Types ───────────────────────────────────────────────────

/**
 * Graded relevance for a single result.
 * 0 = not relevant, 1 = partially relevant, 2 = good match, 3 = perfect match
 */
export type RelevanceGrade = 0 | 1 | 2 | 3;

export interface GradedResult {
  gameId: string;
  gameName: string;
  relevance: RelevanceGrade;
  /** Optional: tags for diversity calculation */
  tags?: string[];
  /** Optional: popularity (ratingCount) for novelty calculation */
  ratingCount?: number;
}

export interface EvalMetrics {
  ndcg: number;       // Normalized Discounted Cumulative Gain (0-1, higher = better ranking)
  map: number;        // Mean Average Precision (0-1, higher = more relevant items ranked higher)
  mrr: number;        // Mean Reciprocal Rank (0-1, higher = first relevant item found sooner)
  hitRate: number;    // Hit Rate (0 or 1, was any relevant item in top K?)
  precision: number;  // Precision@K (fraction of top K that are relevant)
  recall: number;     // Recall@K (fraction of all relevant items that appear in top K)
  ild: number;        // Intra-List Diversity (0-1, higher = more diverse results)
  novelty: number;    // Novelty (higher = more obscure/long-tail recommendations)
  constraintViolationRate: number; // Fraction of results violating stated constraints
}

// ─── NDCG@K ─────────────────────────────────────────────────

/**
 * Normalized Discounted Cumulative Gain at K.
 *
 * Formula:
 *   DCG@K  = sum_{i=1}^{K} rel_i / log_2(i + 1)
 *   IDCG@K = DCG@K for ideal ranking (sorted by relevance desc)
 *   NDCG@K = DCG@K / IDCG@K
 *
 * Handles edge case: if IDCG = 0 (no relevant items in ground truth), returns 0.
 */
export function ndcgAtK(results: GradedResult[], k: number): number {
  const topK = results.slice(0, k);
  const dcg = computeDCG(topK.map(r => r.relevance));

  // Ideal ranking: sort all available relevances descending, take top K
  const idealRelevances = results
    .map(r => r.relevance)
    .sort((a, b) => b - a)
    .slice(0, k);
  const idcg = computeDCG(idealRelevances);

  if (idcg === 0) return 0;
  return dcg / idcg;
}

function computeDCG(relevances: number[]): number {
  let dcg = 0;
  for (let i = 0; i < relevances.length; i++) {
    // Position is 1-indexed: log_2(i + 2) because i is 0-indexed
    dcg += relevances[i] / Math.log2(i + 2);
  }
  return dcg;
}

// ─── MAP@K ──────────────────────────────────────────────────

/**
 * Average Precision at K for a single query.
 *
 * Formula:
 *   AP@K = (1 / min(|relevant|, K)) * sum_{k=1}^{K} Precision@k * rel(k)
 *
 * Where rel(k) = 1 if item at position k is relevant (grade >= 1), else 0.
 * Precision@k = count of relevant items in positions 1..k / k
 */
export function averagePrecisionAtK(results: GradedResult[], k: number, totalRelevant: number): number {
  const topK = results.slice(0, k);
  const denominator = Math.min(totalRelevant, k);
  if (denominator === 0) return 0;

  let relevantSoFar = 0;
  let sumPrecision = 0;

  for (let i = 0; i < topK.length; i++) {
    const isRelevant = topK[i].relevance >= 1;
    if (isRelevant) {
      relevantSoFar++;
      sumPrecision += relevantSoFar / (i + 1);
    }
  }

  return sumPrecision / denominator;
}

// ─── MRR ────────────────────────────────────────────────────

/**
 * Reciprocal Rank for a single query.
 *
 * Formula:
 *   RR = 1 / rank_of_first_relevant_item
 *
 * Returns 0 if no relevant item found in results.
 */
export function reciprocalRank(results: GradedResult[]): number {
  for (let i = 0; i < results.length; i++) {
    if (results[i].relevance >= 1) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

// ─── Hit Rate@K ─────────────────────────────────────────────

/**
 * Hit Rate at K: 1 if any relevant item in top K, else 0.
 */
export function hitRateAtK(results: GradedResult[], k: number): number {
  return results.slice(0, k).some(r => r.relevance >= 1) ? 1 : 0;
}

// ─── Precision@K ────────────────────────────────────────────

/**
 * Precision at K: fraction of top K results that are relevant.
 */
export function precisionAtK(results: GradedResult[], k: number): number {
  const topK = results.slice(0, k);
  if (topK.length === 0) return 0;
  const relevant = topK.filter(r => r.relevance >= 1).length;
  return relevant / topK.length;
}

// ─── Recall@K ───────────────────────────────────────────────

/**
 * Recall at K: fraction of all relevant items that appear in top K.
 */
export function recallAtK(results: GradedResult[], k: number, totalRelevant: number): number {
  if (totalRelevant === 0) return 0;
  const topK = results.slice(0, k);
  const relevant = topK.filter(r => r.relevance >= 1).length;
  return relevant / totalRelevant;
}

// ─── Intra-List Diversity (ILD) ─────────────────────────────

/**
 * Intra-List Diversity at K.
 *
 * Formula:
 *   ILD@K = (2 / (K * (K-1))) * sum over all pairs: distance(item_i, item_j)
 *
 * Distance is measured as Jaccard distance on tag sets:
 *   distance(A, B) = 1 - |A intersect B| / |A union B|
 *
 * Returns 0 for lists with < 2 items.
 */
export function ildAtK(results: GradedResult[], k: number): number {
  const topK = results.slice(0, k).filter(r => r.tags && r.tags.length > 0);
  if (topK.length < 2) return 0;

  let totalDistance = 0;
  let pairCount = 0;

  for (let i = 0; i < topK.length; i++) {
    for (let j = i + 1; j < topK.length; j++) {
      const tagsA = new Set(topK[i].tags!.map(t => t.toLowerCase()));
      const tagsB = new Set(topK[j].tags!.map(t => t.toLowerCase()));

      const intersection = new Set([...tagsA].filter(t => tagsB.has(t)));
      const union = new Set([...tagsA, ...tagsB]);

      const jaccard = union.size > 0 ? intersection.size / union.size : 0;
      totalDistance += 1 - jaccard; // Jaccard distance
      pairCount++;
    }
  }

  return pairCount > 0 ? totalDistance / pairCount : 0;
}

// ─── Novelty@K ──────────────────────────────────────────────

/**
 * Novelty at K.
 *
 * Formula:
 *   Novelty@K = (1/K) * sum_{i=1}^{K} -log_2(popularity(i))
 *
 * Where popularity = ratingCount / maxRatingCount (normalized to 0-1).
 * Higher novelty = recommending more obscure/long-tail games.
 *
 * @param maxRatingCount The maximum rating count in the entire catalog (for normalization)
 */
export function noveltyAtK(results: GradedResult[], k: number, maxRatingCount: number): number {
  const topK = results.slice(0, k).filter(r => r.ratingCount !== undefined);
  if (topK.length === 0 || maxRatingCount === 0) return 0;

  let totalNovelty = 0;
  for (const r of topK) {
    const popularity = Math.max(r.ratingCount! / maxRatingCount, 0.0001); // avoid log(0)
    totalNovelty += -Math.log2(popularity);
  }

  return totalNovelty / topK.length;
}

// ─── Aggregate Metrics ──────────────────────────────────────

/**
 * Compute all metrics for a single query's results.
 */
export function computeQueryMetrics(
  results: GradedResult[],
  k: number,
  totalRelevant: number,
  maxRatingCount: number,
  constraintViolations: number = 0,
): EvalMetrics {
  return {
    ndcg: ndcgAtK(results, k),
    map: averagePrecisionAtK(results, k, totalRelevant),
    mrr: reciprocalRank(results),
    hitRate: hitRateAtK(results, k),
    precision: precisionAtK(results, k),
    recall: recallAtK(results, k, totalRelevant),
    ild: ildAtK(results, k),
    novelty: noveltyAtK(results, k, maxRatingCount),
    constraintViolationRate: results.slice(0, k).length > 0
      ? constraintViolations / results.slice(0, k).length
      : 0,
  };
}

/**
 * Average metrics across multiple queries.
 */
export function averageMetrics(allMetrics: EvalMetrics[]): EvalMetrics {
  if (allMetrics.length === 0) {
    return {
      ndcg: 0, map: 0, mrr: 0, hitRate: 0,
      precision: 0, recall: 0, ild: 0, novelty: 0,
      constraintViolationRate: 0,
    };
  }

  const avg = (key: keyof EvalMetrics) =>
    allMetrics.reduce((sum, m) => sum + m[key], 0) / allMetrics.length;

  return {
    ndcg: avg('ndcg'),
    map: avg('map'),
    mrr: avg('mrr'),
    hitRate: avg('hitRate'),
    precision: avg('precision'),
    recall: avg('recall'),
    ild: avg('ild'),
    novelty: avg('novelty'),
    constraintViolationRate: avg('constraintViolationRate'),
  };
}

/**
 * Format metrics as a readable report string.
 */
export function formatMetrics(metrics: EvalMetrics, label: string = 'Overall'): string {
  const lines = [
    `${label}:`,
    `  NDCG@10:      ${metrics.ndcg.toFixed(4)}`,
    `  MAP@10:       ${metrics.map.toFixed(4)}`,
    `  MRR:          ${metrics.mrr.toFixed(4)}`,
    `  HitRate@5:    ${metrics.hitRate.toFixed(4)}`,
    `  Precision@10: ${metrics.precision.toFixed(4)}`,
    `  Recall@10:    ${metrics.recall.toFixed(4)}`,
    `  ILD@10:       ${metrics.ild.toFixed(4)}  (diversity)`,
    `  Novelty@10:   ${metrics.novelty.toFixed(2)}`,
    `  Constraint violation rate: ${(metrics.constraintViolationRate * 100).toFixed(1)}%`,
  ];
  return lines.join('\n');
}
