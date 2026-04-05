/**
 * Evaluation Metrics
 *
 * Reuses the battle-tested metrics from scripts/eval-metrics.ts
 * with additions for the new framework.
 */

import type { RelevanceGrade, CaseMetrics, GameResult, EvalCase } from './types';

interface GradedResult {
  relevance: RelevanceGrade;
  tags?: string[];
  ratingCount?: number;
}

// ─── NDCG@K ─────────────────────────────────────────────────

function computeDCG(relevances: number[]): number {
  let dcg = 0;
  for (let i = 0; i < relevances.length; i++) {
    dcg += relevances[i] / Math.log2(i + 2);
  }
  return dcg;
}

export function ndcgAtK(results: GradedResult[], k: number): number {
  const topK = results.slice(0, k);
  const dcg = computeDCG(topK.map(r => r.relevance));
  const idealRelevances = results
    .map(r => r.relevance)
    .sort((a, b) => b - a)
    .slice(0, k);
  const idcg = computeDCG(idealRelevances);
  if (idcg === 0) return 0;
  return dcg / idcg;
}

// ─── Precision@K ────────────────────────────────────────────

export function precisionAtK(results: GradedResult[], k: number): number {
  const topK = results.slice(0, k);
  if (topK.length === 0) return 0;
  return topK.filter(r => r.relevance >= 1).length / topK.length;
}

// ─── MRR ────────────────────────────────────────────────────

export function reciprocalRank(results: GradedResult[]): number {
  for (let i = 0; i < results.length; i++) {
    if (results[i].relevance >= 1) return 1 / (i + 1);
  }
  return 0;
}

// ─── Hit Rate@K ─────────────────────────────────────────────

export function hitRateAtK(results: GradedResult[], k: number): number {
  return results.slice(0, k).some(r => r.relevance >= 1) ? 1 : 0;
}

// ─── Compute Case Metrics ───────────────────────────────────

export function computeCaseMetrics(
  results: GameResult[],
  evalCase: EvalCase,
  constraintViolationCount: number,
): CaseMetrics {
  // Build relevance map from ideal/anti games
  const relevanceMap = new Map<string, RelevanceGrade>();
  for (const ig of evalCase.idealGames) {
    relevanceMap.set(ig.name.toLowerCase(), ig.relevance);
  }
  for (const ag of evalCase.antiGames) {
    relevanceMap.set(ag.name.toLowerCase(), 0);
  }

  // Grade results
  const graded: GradedResult[] = results.slice(0, 20).map(r => {
    const name = (r.name ?? '').toLowerCase();
    let relevance: RelevanceGrade = 1; // Default: partial match

    // Check known games
    for (const [known, rel] of relevanceMap) {
      if (name.includes(known) || known.includes(name)) {
        relevance = rel;
        break;
      }
    }

    return {
      relevance,
      tags: [...(r.categories ?? []), ...(r.mechanics ?? []), ...(r.themes ?? [])],
      ratingCount: r.ratingCount ?? 0,
    };
  });

  const k = 10;
  const violationRate = results.slice(0, k).length > 0
    ? constraintViolationCount / results.slice(0, k).length
    : 0;

  return {
    ndcg10: ndcgAtK(graded, k),
    precision10: precisionAtK(graded, k),
    mrr: reciprocalRank(graded),
    hitRate5: hitRateAtK(graded, 5),
    constraintViolationRate: violationRate,
  };
}
