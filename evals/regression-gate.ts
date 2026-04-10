/**
 * Regression Gate
 *
 * Automated guardrail that checks whether a new eval run represents
 * a regression vs the previous run. Prints a clear PASS/FAIL verdict.
 *
 * Rules:
 * 1. Overall pass rate must not drop >3 percentage points
 * 2. No individual category can regress >10 percentage points
 * 3. Constraint violation rate must not increase by >1%
 * 4. Zero new trust busters in the top 5 (anti-games)
 * 5. If significance testing available, changes must be within 95% CI
 *    OR show significant improvement
 */

import type { EvalRun, CategorySummary } from './types';
import { bootstrapPassRate } from './significance';

interface GateResult {
  passed: boolean;
  violations: GateViolation[];
  summary: string;
}

interface GateViolation {
  rule: string;
  severity: 'critical' | 'warning';
  detail: string;
}

const PASS_RATE_MAX_DROP = 0.03;       // 3 percentage points
const CATEGORY_MAX_DROP = 0.10;        // 10 percentage points
const VIOLATION_MAX_INCREASE = 0.01;   // 1 percentage point

export function checkRegressionGate(
  current: EvalRun,
  previous: EvalRun,
): GateResult {
  const violations: GateViolation[] = [];

  // Rule 1: Overall pass rate
  const passRateDelta = current.passRate - previous.passRate;
  if (passRateDelta < -PASS_RATE_MAX_DROP) {
    violations.push({
      rule: 'Pass rate regression',
      severity: 'critical',
      detail: `Pass rate dropped ${(passRateDelta * 100).toFixed(1)}pp (${(previous.passRate * 100).toFixed(1)}% -> ${(current.passRate * 100).toFixed(1)}%), max allowed: -${(PASS_RATE_MAX_DROP * 100).toFixed(0)}pp`,
    });
  }

  // Rule 2: Per-category regression
  for (const [cat, currentSummary] of Object.entries(current.categoryBreakdown)) {
    const prevSummary = previous.categoryBreakdown[cat];
    if (!prevSummary) continue;

    const catDelta = currentSummary.passRate - prevSummary.passRate;
    if (catDelta < -CATEGORY_MAX_DROP && currentSummary.totalCases >= 10) {
      violations.push({
        rule: `Category regression: ${cat}`,
        severity: 'critical',
        detail: `${cat} dropped ${(catDelta * 100).toFixed(1)}pp (${(prevSummary.passRate * 100).toFixed(0)}% -> ${(currentSummary.passRate * 100).toFixed(0)}%), max allowed: -${(CATEGORY_MAX_DROP * 100).toFixed(0)}pp`,
      });
    }
  }

  // Rule 3: Constraint violation rate
  const violDelta = current.aggregateMetrics.avgConstraintViolationRate -
    previous.aggregateMetrics.avgConstraintViolationRate;
  if (violDelta > VIOLATION_MAX_INCREASE) {
    violations.push({
      rule: 'Constraint violations increased',
      severity: 'critical',
      detail: `Violation rate increased ${(violDelta * 100).toFixed(1)}pp (${(previous.aggregateMetrics.avgConstraintViolationRate * 100).toFixed(1)}% -> ${(current.aggregateMetrics.avgConstraintViolationRate * 100).toFixed(1)}%), max allowed: +${(VIOLATION_MAX_INCREASE * 100).toFixed(0)}pp`,
    });
  }

  // Rule 4: Trust buster increase
  const prevTrust = previous.aggregateMetrics.trustBusterCount ?? 0;
  const currTrust = current.aggregateMetrics.trustBusterCount ?? 0;
  if (currTrust > prevTrust) {
    violations.push({
      rule: 'New trust busters',
      severity: 'warning',
      detail: `Trust busters increased from ${prevTrust} to ${currTrust} (+${currTrust - prevTrust})`,
    });
  }

  // Rule 5: Statistical significance check (if enough shared cases)
  const sigResult = bootstrapPassRate(previous.cases, current.cases, 2000);
  if (sigResult.sharedCases > 50 && passRateDelta < 0 && sigResult.pValue < 0.05) {
    violations.push({
      rule: 'Statistically significant regression',
      severity: 'critical',
      detail: `Pass rate drop is statistically significant (p=${sigResult.pValue.toFixed(3)}, 95% CI [${(sigResult.ci95[0] * 100).toFixed(1)}%, ${(sigResult.ci95[1] * 100).toFixed(1)}%])`,
    });
  }

  // Determine pass/fail: critical violations = fail
  const criticals = violations.filter(v => v.severity === 'critical');
  const passed = criticals.length === 0;

  // Build summary
  const lines: string[] = [];
  const bar = '='.repeat(60);

  if (passed) {
    lines.push(`${bar}`);
    lines.push(`  REGRESSION GATE: PASS`);
    lines.push(`${bar}`);
    if (violations.length > 0) {
      lines.push(`  Warnings (non-blocking):`);
      for (const v of violations) {
        lines.push(`    - ${v.detail}`);
      }
    }
    lines.push(`  Pass rate: ${(previous.passRate * 100).toFixed(1)}% -> ${(current.passRate * 100).toFixed(1)}% (${passRateDelta >= 0 ? '+' : ''}${(passRateDelta * 100).toFixed(1)}pp)`);
    if (sigResult.sharedCases > 50) {
      lines.push(`  Significance: p=${sigResult.pValue.toFixed(3)}, 95% CI [${(sigResult.ci95[0] * 100).toFixed(1)}%, ${(sigResult.ci95[1] * 100).toFixed(1)}%]`);
    }
  } else {
    lines.push(`${bar}`);
    lines.push(`  REGRESSION GATE: FAIL (${criticals.length} critical violation${criticals.length > 1 ? 's' : ''})`);
    lines.push(`${bar}`);
    for (const v of violations) {
      const icon = v.severity === 'critical' ? 'X' : '!';
      lines.push(`  [${icon}] ${v.rule}: ${v.detail}`);
    }
  }
  lines.push(bar);

  return {
    passed,
    violations,
    summary: lines.join('\n'),
  };
}
