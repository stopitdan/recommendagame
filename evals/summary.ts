/**
 * Eval Run Summary Viewer
 *
 * Shows a quick summary of the latest eval run, or all runs.
 *
 * Usage:
 *   npx tsx evals/summary.ts          # Latest run
 *   npx tsx evals/summary.ts --all    # All runs history
 *   npx tsx evals/summary.ts RUN_ID   # Specific run
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EvalRun } from './types';

const RUNS_DIR = path.join(process.cwd(), 'evals', 'runs');

function loadRun(file: string): EvalRun {
  return JSON.parse(fs.readFileSync(path.join(RUNS_DIR, file), 'utf8'));
}

function showRunSummary(run: EvalRun, compact = false) {
  const m = run.aggregateMetrics;
  if (compact) {
    const judge = m.avgLlmJudgeScore != null ? ` Judge=${m.avgLlmJudgeScore.toFixed(1)}/10` : '';
    console.log(`  ${run.runId}  Pass=${(run.passRate * 100).toFixed(0)}%  NDCG=${m.avgNdcg10.toFixed(3)}  MRR=${m.avgMrr.toFixed(3)}  Violations=${(m.avgConstraintViolationRate * 100).toFixed(0)}%${judge}  (${run.totalCases} cases, ${run.durationSeconds.toFixed(0)}s)`);
    return;
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`  Run: ${run.runId}`);
  console.log(`  Date: ${run.startedAt}`);
  console.log(`  Duration: ${run.durationSeconds.toFixed(0)}s | Cases: ${run.totalCases}`);
  console.log(`${'='.repeat(72)}`);

  console.log(`\n  Pass Rate: ${run.passedCases}/${run.totalCases} (${(run.passRate * 100).toFixed(1)}%)`);
  console.log(`  NDCG@10:   ${m.avgNdcg10.toFixed(4)}`);
  console.log(`  MRR:       ${m.avgMrr.toFixed(4)}`);
  console.log(`  Precision: ${m.avgPrecision10.toFixed(4)}`);
  console.log(`  Hit Rate:  ${m.avgHitRate5.toFixed(4)}`);
  console.log(`  Violations: ${(m.avgConstraintViolationRate * 100).toFixed(1)}%`);
  if (m.avgLlmJudgeScore != null) {
    console.log(`  LLM Judge: ${m.avgLlmJudgeScore.toFixed(2)}/10`);
  }
  console.log(`  Latency:   p50=${m.p50LatencyMs}ms p95=${m.p95LatencyMs}ms`);

  // Category breakdown
  console.log(`\n  Categories:`);
  const cats = Object.entries(run.categoryBreakdown).sort((a, b) => a[1].passRate - b[1].passRate);
  for (const [cat, cs] of cats) {
    console.log(`    ${cat.padEnd(24)} ${cs.passedCases}/${cs.totalCases} (${(cs.passRate * 100).toFixed(0)}%)  NDCG=${cs.avgNdcg10.toFixed(3)}`);
  }

  // Failure distribution
  if (Object.keys(run.failureDistribution).length > 0) {
    console.log(`\n  Failures:`);
    for (const [type, count] of Object.entries(run.failureDistribution).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type.padEnd(28)} ${count}`);
    }
  }

  // Worst 10
  if (run.worstCases.length > 0) {
    console.log(`\n  Worst Cases:`);
    for (const c of run.worstCases.slice(0, 10)) {
      const judge = c.llmJudgeScore != null ? ` Judge=${c.llmJudgeScore}/10` : '';
      console.log(`    [${c.caseId}]${judge} "${c.query.slice(0, 50)}"`);
      if (c.idealGamesMissing.length > 0) console.log(`      Missing: ${c.idealGamesMissing.join(', ')}`);
      if (c.antiGamesFound.length > 0) console.log(`      BAD: ${c.antiGamesFound.join(', ')}`);
      console.log(`      Top 3: ${c.results.slice(0, 3).map(r => r.name).join(' | ')}`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);

  if (!fs.existsSync(RUNS_DIR)) {
    console.log('No runs found. Run `npm run eval` first.');
    process.exit(1);
  }

  const files = fs.readdirSync(RUNS_DIR).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.log('No runs found. Run `npm run eval` first.');
    process.exit(1);
  }

  if (args.includes('--all')) {
    console.log(`\n${'='.repeat(72)}`);
    console.log(`  EVAL RUN HISTORY (${files.length} runs)`);
    console.log(`${'='.repeat(72)}\n`);
    for (const file of files) {
      const run = loadRun(file);
      showRunSummary(run, true);
    }
    console.log('');
    return;
  }

  const targetFile = args[0]
    ? files.find(f => f.includes(args[0])) ?? files[files.length - 1]
    : files[files.length - 1];

  const run = loadRun(targetFile);
  showRunSummary(run);
}

main();
