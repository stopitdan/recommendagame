/**
 * Failure Analysis Tool
 *
 * Reads the latest eval run and produces a detailed analysis of
 * WHY cases fail, grouped by failure pattern. This is the key
 * tool for understanding what to fix in the engine.
 *
 * Usage:
 *   npx tsx evals/analyze-failures.ts          # Latest run
 *   npx tsx evals/analyze-failures.ts RUN_ID   # Specific run
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EvalRun, CaseResult } from './types';

const RUNS_DIR = path.join(process.cwd(), 'evals', 'runs');

function loadLatestRun(): EvalRun {
  const files = fs.readdirSync(RUNS_DIR).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) throw new Error('No runs found');
  const target = process.argv[2]
    ? files.find(f => f.includes(process.argv[2])) ?? files[files.length - 1]
    : files[files.length - 1];
  return JSON.parse(fs.readFileSync(path.join(RUNS_DIR, target), 'utf8'));
}

interface FailurePattern {
  pattern: string;
  description: string;
  count: number;
  cases: { id: string; query: string; detail: string }[];
}

function analyzeFailures(run: EvalRun): FailurePattern[] {
  const patterns: FailurePattern[] = [];
  const failedCases = run.cases.filter(c => !c.passed);

  // Pattern 1: Missing famous games (ideal games not found)
  const missingFamous: FailurePattern = {
    pattern: 'missing-famous-game',
    description: 'The engine returns relevant results but misses the canonical/famous game for the query. User expects THE obvious answer.',
    count: 0,
    cases: [],
  };

  // Pattern 2: Constraint violations
  const constraintViolations: FailurePattern = {
    pattern: 'constraint-violation',
    description: 'Results violate explicitly stated constraints (player count, time, complexity).',
    count: 0,
    cases: [],
  };

  // Pattern 3: Completely irrelevant results
  const irrelevant: FailurePattern = {
    pattern: 'irrelevant-results',
    description: 'Results are completely unrelated to the query theme, mechanic, or intent.',
    count: 0,
    cases: [],
  };

  // Pattern 4: Anti-game present
  const antiPresent: FailurePattern = {
    pattern: 'anti-game-present',
    description: 'A game that should NEVER appear for this query is in the results.',
    count: 0,
    cases: [],
  };

  // Pattern 5: Wrong game type
  const wrongType: FailurePattern = {
    pattern: 'wrong-game-type',
    description: 'Board game results for video game query or vice versa.',
    count: 0,
    cases: [],
  };

  // Pattern 6: LLM judge low score
  const lowJudge: FailurePattern = {
    pattern: 'llm-judge-low-score',
    description: 'LLM judge rated the overall result quality below 5/10.',
    count: 0,
    cases: [],
  };

  // Pattern 7: Empty or error results
  const emptyResults: FailurePattern = {
    pattern: 'empty-or-error',
    description: 'API returned no results or an error.',
    count: 0,
    cases: [],
  };

  for (const c of failedCases) {
    // Check which patterns apply
    if (c.idealGamesMissing.length > 0) {
      missingFamous.count++;
      missingFamous.cases.push({
        id: c.caseId,
        query: c.query.slice(0, 60),
        detail: `Missing: ${c.idealGamesMissing.join(', ')} | Got: ${c.results.slice(0, 3).map(r => r.name).join(', ')}`,
      });
    }

    if (c.constraintViolations.length > 0) {
      constraintViolations.count++;
      const viols = c.constraintViolations.slice(0, 3).map(v =>
        `#${v.rank} ${v.gameName}: ${v.detail}`
      ).join('; ');
      constraintViolations.cases.push({
        id: c.caseId,
        query: c.query.slice(0, 60),
        detail: viols,
      });
    }

    if (c.antiGamesFound.length > 0) {
      antiPresent.count++;
      antiPresent.cases.push({
        id: c.caseId,
        query: c.query.slice(0, 60),
        detail: `Found: ${c.antiGamesFound.join(', ')}`,
      });
    }

    if (c.llmJudgeScore != null && c.llmJudgeScore < 5) {
      lowJudge.count++;
      lowJudge.cases.push({
        id: c.caseId,
        query: c.query.slice(0, 60),
        detail: `Score: ${c.llmJudgeScore}/10 - ${(c.llmJudgeReason ?? '').slice(0, 100)}`,
      });
    }

    if (c.results.length === 0) {
      emptyResults.count++;
      emptyResults.cases.push({
        id: c.caseId,
        query: c.query.slice(0, 60),
        detail: 'No results returned',
      });
    }

    // Check for wrong game type
    if (c.results.length > 0) {
      const wantedTypes = new Set<string>();
      // Can't easily determine from CaseResult alone, skip for now
    }
  }

  return [
    missingFamous,
    constraintViolations,
    antiPresent,
    lowJudge,
    emptyResults,
  ].filter(p => p.count > 0).sort((a, b) => b.count - a.count);
}

function main() {
  const run = loadLatestRun();

  const bar = '='.repeat(80);
  const thin = '-'.repeat(80);

  console.log(`\n${bar}`);
  console.log('  FAILURE ANALYSIS REPORT');
  console.log(`  Run: ${run.runId} | Total: ${run.totalCases} | Failed: ${run.failedCases} (${((1 - run.passRate) * 100).toFixed(1)}%)`);
  console.log(bar);

  const patterns = analyzeFailures(run);

  for (const pattern of patterns) {
    console.log(`\n  PATTERN: ${pattern.pattern} (${pattern.count} cases)`);
    console.log(`  ${pattern.description}`);
    console.log(thin);
    for (const c of pattern.cases.slice(0, 20)) {
      console.log(`    [${c.id}] "${c.query}"`);
      console.log(`      ${c.detail}`);
    }
    if (pattern.cases.length > 20) {
      console.log(`    ... and ${pattern.cases.length - 20} more`);
    }
  }

  // Summary statistics
  console.log(`\n${bar}`);
  console.log('  SUMMARY');
  console.log(thin);

  const failedCases = run.cases.filter(c => !c.passed);

  // Judge score distribution for failed cases
  const judgedFailed = failedCases.filter(c => c.llmJudgeScore != null);
  if (judgedFailed.length > 0) {
    const judgeScores = judgedFailed.map(c => c.llmJudgeScore!);
    const buckets = [0, 0, 0, 0, 0]; // 0-2, 3-4, 5-6, 7-8, 9-10
    for (const s of judgeScores) {
      if (s <= 2) buckets[0]++;
      else if (s <= 4) buckets[1]++;
      else if (s <= 6) buckets[2]++;
      else if (s <= 8) buckets[3]++;
      else buckets[4]++;
    }
    console.log('  LLM Judge Score Distribution (failed cases):');
    console.log(`    0-2 (terrible):  ${'#'.repeat(buckets[0])} ${buckets[0]}`);
    console.log(`    3-4 (poor):      ${'#'.repeat(buckets[1])} ${buckets[1]}`);
    console.log(`    5-6 (mediocre):  ${'#'.repeat(buckets[2])} ${buckets[2]}`);
    console.log(`    7-8 (good):      ${'#'.repeat(buckets[3])} ${buckets[3]}`);
    console.log(`    9-10 (great):    ${'#'.repeat(buckets[4])} ${buckets[4]}`);
  }

  // Most common missing games
  const missingGameCount = new Map<string, number>();
  for (const c of failedCases) {
    for (const g of c.idealGamesMissing) {
      missingGameCount.set(g, (missingGameCount.get(g) ?? 0) + 1);
    }
  }
  if (missingGameCount.size > 0) {
    console.log('\n  Most Commonly Missing Games:');
    const sorted = [...missingGameCount.entries()].sort((a, b) => b[1] - a[1]);
    for (const [game, count] of sorted.slice(0, 15)) {
      console.log(`    ${game.padEnd(35)} missing in ${count} cases`);
    }
  }

  // Save analysis
  const analysisFile = path.join(process.cwd(), 'evals', 'logs', `${run.runId}-analysis.log`);
  // Redirect would require more work, so just note the file
  console.log(`\n${bar}`);

  // Write detailed JSON analysis
  const analysisJson = {
    runId: run.runId,
    totalCases: run.totalCases,
    failedCases: run.failedCases,
    passRate: run.passRate,
    patterns: patterns.map(p => ({
      pattern: p.pattern,
      count: p.count,
      cases: p.cases,
    })),
    missingGameFrequency: Object.fromEntries(
      [...missingGameCount.entries()].sort((a, b) => b[1] - a[1])
    ),
  };
  const jsonFile = path.join(process.cwd(), 'evals', 'logs', `${run.runId}-analysis.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(analysisJson, null, 2));
  console.log(`  Analysis saved to ${jsonFile}`);
}

main();
