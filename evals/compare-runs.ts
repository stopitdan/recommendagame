/**
 * Compare two eval runs side-by-side.
 *
 * Usage:
 *   npx tsx evals/compare-runs.ts                # Compare last 2 runs
 *   npx tsx evals/compare-runs.ts RUN_A RUN_B    # Compare specific runs
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EvalRun } from './types';

const RUNS_DIR = path.join(process.cwd(), 'evals', 'runs');

function loadRun(runIdOrFile: string): EvalRun {
  const filePath = runIdOrFile.endsWith('.json')
    ? path.join(RUNS_DIR, runIdOrFile)
    : path.join(RUNS_DIR, `${runIdOrFile}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getLastNRuns(n: number): string[] {
  return fs.readdirSync(RUNS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .slice(-n);
}

function main() {
  const args = process.argv.slice(2);
  let runA: EvalRun, runB: EvalRun;

  if (args.length >= 2) {
    runA = loadRun(args[0]);
    runB = loadRun(args[1]);
  } else {
    const last = getLastNRuns(2);
    if (last.length < 2) {
      console.log('Need at least 2 runs to compare. Run the eval suite at least twice.');
      process.exit(1);
    }
    runA = loadRun(last[0]);
    runB = loadRun(last[1]);
  }

  const bar = '='.repeat(80);
  const thin = '-'.repeat(80);

  console.log(`\n${bar}`);
  console.log('  EVAL RUN COMPARISON');
  console.log(`  Run A: ${runA.runId} (${runA.totalCases} cases)`);
  console.log(`  Run B: ${runB.runId} (${runB.totalCases} cases)`);
  console.log(bar);

  const sign = (n: number) => n >= 0 ? `+${n.toFixed(4)}` : n.toFixed(4);
  const pctSign = (n: number) => n >= 0 ? `+${(n * 100).toFixed(1)}%` : `${(n * 100).toFixed(1)}%`;

  // Overall
  console.log('\n  OVERALL');
  console.log(thin);
  const metrics = [
    ['Pass Rate', runA.passRate, runB.passRate, true],
    ['Avg NDCG@10', runA.aggregateMetrics.avgNdcg10, runB.aggregateMetrics.avgNdcg10, false],
    ['Avg MRR', runA.aggregateMetrics.avgMrr, runB.aggregateMetrics.avgMrr, false],
    ['Avg Precision@10', runA.aggregateMetrics.avgPrecision10, runB.aggregateMetrics.avgPrecision10, false],
    ['Avg Hit Rate@5', runA.aggregateMetrics.avgHitRate5, runB.aggregateMetrics.avgHitRate5, false],
    ['Constraint Viol', runA.aggregateMetrics.avgConstraintViolationRate, runB.aggregateMetrics.avgConstraintViolationRate, false],
    ['Avg Latency', runA.aggregateMetrics.avgLatencyMs, runB.aggregateMetrics.avgLatencyMs, false],
  ] as const;

  for (const [name, a, b, isPct] of metrics) {
    const delta = (b as number) - (a as number);
    const better = name === 'Constraint Viol' || name === 'Avg Latency' ? delta < 0 : delta > 0;
    const arrow = better ? ' ^' : delta === 0 ? ' =' : ' v';
    console.log(`  ${(name as string).padEnd(22)} ${(a as number).toFixed(4)}  ->  ${(b as number).toFixed(4)}  (${sign(delta)})${arrow}`);
  }

  if (runA.aggregateMetrics.avgLlmJudgeScore != null && runB.aggregateMetrics.avgLlmJudgeScore != null) {
    const delta = runB.aggregateMetrics.avgLlmJudgeScore - runA.aggregateMetrics.avgLlmJudgeScore;
    console.log(`  ${'LLM Judge Score'.padEnd(22)} ${runA.aggregateMetrics.avgLlmJudgeScore.toFixed(2)}  ->  ${runB.aggregateMetrics.avgLlmJudgeScore.toFixed(2)}  (${sign(delta)})`);
  }

  // Per-category comparison
  console.log(`\n  PER-CATEGORY`);
  console.log(thin);
  const allCats = new Set([...Object.keys(runA.categoryBreakdown), ...Object.keys(runB.categoryBreakdown)]);
  for (const cat of [...allCats].sort()) {
    const a = runA.categoryBreakdown[cat];
    const b = runB.categoryBreakdown[cat];
    if (!a || !b) continue;
    const passRateDelta = b.passRate - a.passRate;
    const ndcgDelta = b.avgNdcg10 - a.avgNdcg10;
    const arrow = passRateDelta > 0 ? '^' : passRateDelta < 0 ? 'v' : '=';
    console.log(`  ${cat.padEnd(24)} ${(a.passRate * 100).toFixed(0)}% -> ${(b.passRate * 100).toFixed(0)}%  NDCG ${a.avgNdcg10.toFixed(3)} -> ${b.avgNdcg10.toFixed(3)} ${arrow}`);
  }

  // Case-level changes
  const aCaseMap = new Map(runA.cases.map(c => [c.caseId, c]));
  const bCaseMap = new Map(runB.cases.map(c => [c.caseId, c]));

  const newlyPassing: string[] = [];
  const newlyFailing: string[] = [];
  const bigImprovements: string[] = [];
  const bigRegressions: string[] = [];

  for (const [id, bCase] of bCaseMap) {
    const aCase = aCaseMap.get(id);
    if (!aCase) continue;

    if (bCase.passed && !aCase.passed) newlyPassing.push(id);
    if (!bCase.passed && aCase.passed) newlyFailing.push(id);

    const judgeDelta = (bCase.llmJudgeScore ?? 0) - (aCase.llmJudgeScore ?? 0);
    if (judgeDelta >= 3) bigImprovements.push(`${id}: ${aCase.llmJudgeScore ?? '?'} -> ${bCase.llmJudgeScore ?? '?'}`);
    if (judgeDelta <= -3) bigRegressions.push(`${id}: ${aCase.llmJudgeScore ?? '?'} -> ${bCase.llmJudgeScore ?? '?'}`);
  }

  if (newlyPassing.length > 0) {
    console.log(`\n  NEWLY PASSING (${newlyPassing.length})`);
    console.log(thin);
    for (const id of newlyPassing) {
      const c = bCaseMap.get(id)!;
      console.log(`  + [${id}] "${c.query.slice(0, 60)}"`);
    }
  }

  if (newlyFailing.length > 0) {
    console.log(`\n  NEWLY FAILING (${newlyFailing.length}) <<<< REGRESSIONS`);
    console.log(thin);
    for (const id of newlyFailing) {
      const c = bCaseMap.get(id)!;
      console.log(`  - [${id}] "${c.query.slice(0, 60)}"`);
    }
  }

  console.log(`\n${bar}`);
}

main();
