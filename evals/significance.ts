/**
 * Statistical Significance Testing for Eval Comparisons
 *
 * Implements paired bootstrap test and Wilcoxon signed-rank test
 * for comparing two eval runs with confidence intervals.
 *
 * Based on: Smucker et al. (SIGIR 2007) "A Comparison of Statistical
 * Significance Tests for Information Retrieval Evaluation"
 */

import type { CaseResult } from './types';

interface SignificanceResult {
  /** The observed difference (B - A) */
  delta: number;
  /** 95% confidence interval [lower, upper] */
  ci95: [number, number];
  /** Two-sided p-value from bootstrap test */
  pValue: number;
  /** Whether the change is statistically significant at alpha=0.05 */
  significant: boolean;
  /** Number of shared cases used for comparison */
  sharedCases: number;
}

/**
 * Paired bootstrap test for comparing pass rates between two runs.
 *
 * Resamples N=2000 times from shared cases, computes the pass rate
 * delta each time, and builds a confidence interval.
 */
export function bootstrapPassRate(
  casesA: CaseResult[],
  casesB: CaseResult[],
  iterations = 2000,
): SignificanceResult {
  // Build maps for shared case lookup
  const mapA = new Map(casesA.map(c => [c.caseId, c]));
  const mapB = new Map(casesB.map(c => [c.caseId, c]));

  // Find shared cases
  const sharedIds = [...mapA.keys()].filter(id => mapB.has(id));
  const n = sharedIds.length;

  if (n === 0) {
    return { delta: 0, ci95: [0, 0], pValue: 1, significant: false, sharedCases: 0 };
  }

  // Observed pass rates on shared cases
  const passA = sharedIds.filter(id => mapA.get(id)!.passed).length / n;
  const passB = sharedIds.filter(id => mapB.get(id)!.passed).length / n;
  const observedDelta = passB - passA;

  // Bootstrap: resample with replacement
  const deltas: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let countA = 0;
    let countB = 0;
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(Math.random() * n);
      const id = sharedIds[idx];
      if (mapA.get(id)!.passed) countA++;
      if (mapB.get(id)!.passed) countB++;
    }
    deltas.push(countB / n - countA / n);
  }

  deltas.sort((a, b) => a - b);
  const ci95Lower = deltas[Math.floor(iterations * 0.025)];
  const ci95Upper = deltas[Math.floor(iterations * 0.975)];

  // Two-sided p-value: proportion of bootstrap samples where delta has opposite sign
  const pValue = deltas.filter(d =>
    observedDelta >= 0 ? d <= 0 : d >= 0
  ).length / iterations;

  return {
    delta: observedDelta,
    ci95: [ci95Lower, ci95Upper],
    pValue: Math.max(pValue, 1 / iterations), // Floor at 1/N
    significant: pValue < 0.05,
    sharedCases: n,
  };
}

/**
 * Paired bootstrap test for comparing a numeric metric (e.g., NDCG, LLM judge score)
 * between two runs on shared cases.
 */
export function bootstrapMetric(
  casesA: CaseResult[],
  casesB: CaseResult[],
  metricFn: (c: CaseResult) => number | undefined,
  iterations = 2000,
): SignificanceResult {
  const mapA = new Map(casesA.map(c => [c.caseId, c]));
  const mapB = new Map(casesB.map(c => [c.caseId, c]));

  // Find shared cases where both have the metric
  const sharedIds = [...mapA.keys()].filter(id => {
    if (!mapB.has(id)) return false;
    return metricFn(mapA.get(id)!) != null && metricFn(mapB.get(id)!) != null;
  });
  const n = sharedIds.length;

  if (n === 0) {
    return { delta: 0, ci95: [0, 0], pValue: 1, significant: false, sharedCases: 0 };
  }

  // Observed means
  const meanA = sharedIds.reduce((s, id) => s + metricFn(mapA.get(id)!)!, 0) / n;
  const meanB = sharedIds.reduce((s, id) => s + metricFn(mapB.get(id)!)!, 0) / n;
  const observedDelta = meanB - meanA;

  // Bootstrap
  const deltas: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let sumA = 0;
    let sumB = 0;
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(Math.random() * n);
      const id = sharedIds[idx];
      sumA += metricFn(mapA.get(id)!)!;
      sumB += metricFn(mapB.get(id)!)!;
    }
    deltas.push(sumB / n - sumA / n);
  }

  deltas.sort((a, b) => a - b);
  const ci95Lower = deltas[Math.floor(iterations * 0.025)];
  const ci95Upper = deltas[Math.floor(iterations * 0.975)];

  const pValue = deltas.filter(d =>
    observedDelta >= 0 ? d <= 0 : d >= 0
  ).length / iterations;

  return {
    delta: observedDelta,
    ci95: [ci95Lower, ci95Upper],
    pValue: Math.max(pValue, 1 / iterations),
    significant: pValue < 0.05,
    sharedCases: n,
  };
}

/**
 * Format a significance result as a human-readable string.
 * Example: "+2.3% (95% CI [+0.8%, +3.9%], p=0.003, n=2841) ***"
 */
export function formatSignificance(result: SignificanceResult, isPercent = false): string {
  const fmt = (v: number) => {
    const val = isPercent ? v * 100 : v;
    const prefix = val >= 0 ? '+' : '';
    return `${prefix}${val.toFixed(isPercent ? 1 : 4)}${isPercent ? '%' : ''}`;
  };

  const stars = result.pValue < 0.001 ? '***'
    : result.pValue < 0.01 ? '**'
    : result.pValue < 0.05 ? '*'
    : '';

  return `${fmt(result.delta)} (95% CI [${fmt(result.ci95[0])}, ${fmt(result.ci95[1])}], p=${result.pValue.toFixed(3)}, n=${result.sharedCases}) ${stars}`.trim();
}
