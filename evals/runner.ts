/**
 * Core Evaluation Runner
 *
 * Executes eval cases against the recommendation API with:
 * - Configurable parallel concurrency (default: 8 concurrent)
 * - Full constraint violation detection
 * - Optional LLM-as-judge scoring
 * - Persistent logging to JSON files
 * - Regression tracking against previous runs
 * - Per-category breakdown reporting
 *
 * Usage:
 *   npx tsx evals/runner.ts                     # Full suite
 *   npx tsx evals/runner.ts --concurrency=15    # More parallel
 *   npx tsx evals/runner.ts --category=mechanic-focused
 *   npx tsx evals/runner.ts --tag=regression    # Only regression tests
 *   npx tsx evals/runner.ts --no-judge          # Skip LLM judge
 *   npx tsx evals/runner.ts --limit=50          # First 50 cases
 *   npx tsx evals/runner.ts --quick             # Hardcoded cases only, no judge
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type {
  EvalCase, EvalCategory, CaseResult, EvalRun, GameResult,
  AggregateMetrics, CategorySummary, FailureType, RunConfig,
  RegressionReport,
} from './types';
import { computeCaseMetrics } from './metrics';
import { checkConstraintViolations } from './constraint-checker';
import { judgeResults } from './llm-judge';
import { checkRegressionGate } from './regression-gate';

dotenv.config({ path: '.env.local' });

const EVALS_DIR = path.join(process.cwd(), 'evals');
const RUNS_DIR = path.join(EVALS_DIR, 'runs');
const LOGS_DIR = path.join(EVALS_DIR, 'logs');
const CASES_FILE = path.join(EVALS_DIR, 'cases.json');

// ─── Parallel Execution ─────────────────────────────────────

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let index = 0;
  const total = items.length;

  async function worker() {
    while (index < total) {
      const currentIndex = index++;
      await fn(items[currentIndex], currentIndex);
      // Small delay between requests to respect rate limits (30 req/60s)
      await new Promise((r) => setTimeout(r, 2500));
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);
}

// ─── API Query ──────────────────────────────────────────────

async function queryRecommendAPI(
  evalCase: EvalCase,
  apiUrl: string,
): Promise<{ results: GameResult[]; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const body: Record<string, any> = {
      _nocache: true,
      gameTypes: evalCase.gameTypes ?? [],
      playerCount: evalCase.playerCount ?? { min: 1, max: 10 },
      timePresets: evalCase.timePresets ?? [],
      complexity: evalCase.constraints?.complexity ?? { min: 1, max: 5 },
      genres: [],
      moods: [],
      freeText: evalCase.query,
    };

    const res = await fetch(`${apiUrl}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    const latencyMs = Date.now() - start;

    if (res.status === 429) {
      // Rate limited -- wait and retry once
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '5', 10);
      await new Promise((r) => setTimeout(r, (retryAfter || 5) * 1000));
      const retryRes = await fetch(`${apiUrl}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      const retryLatencyMs = Date.now() - start;
      if (!retryRes.ok) {
        return { results: [], latencyMs: retryLatencyMs, error: `HTTP ${retryRes.status} (after retry)` };
      }
      const retryData = await retryRes.json();
      const retryResults: GameResult[] = (retryData.results ?? []).slice(0, 20).map((r: any) => ({
        id: r.id ?? '',
        name: r.name ?? '',
        categories: r.categories ?? [],
        mechanics: r.mechanics ?? [],
        themes: r.themes ?? [],
        minPlayers: r.playerCount?.min ?? r.min_players ?? null,
        maxPlayers: r.playerCount?.max ?? r.max_players ?? null,
        avgPlayTime: r.playTime?.average ?? r.avg_play_time ?? null,
        complexity: r.complexity ?? null,
        rating: r.rating ?? null,
        ratingCount: r.ratingCount ?? r.rating_count ?? null,
        types: r.types ?? [],
        designers: r.designers ?? [],
        _score: r._score ?? null,
      }));
      return { results: retryResults, latencyMs: retryLatencyMs };
    }

    if (!res.ok) {
      return { results: [], latencyMs, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    const results: GameResult[] = (data.results ?? []).slice(0, 20).map((r: any) => ({
      id: r.id ?? '',
      name: r.name ?? '',
      categories: r.categories ?? [],
      mechanics: r.mechanics ?? [],
      themes: r.themes ?? [],
      minPlayers: r.playerCount?.min ?? r.min_players ?? null,
      maxPlayers: r.playerCount?.max ?? r.max_players ?? null,
      avgPlayTime: r.playTime?.average ?? r.avg_play_time ?? null,
      complexity: r.complexity ?? null,
      rating: r.rating ?? null,
      ratingCount: r.ratingCount ?? r.rating_count ?? null,
      types: r.types ?? [],
      designers: r.designers ?? [],
      _score: r._score ?? null,
      _reasons: r._reasons ?? [],
      _breakdown: r._breakdown ?? {},
    }));

    return { results, latencyMs };
  } catch (err) {
    return {
      results: [],
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Case Evaluation ────────────────────────────────────────

/**
 * Match a result game to an eval target.
 * Prefers ID-based matching (exact, no false positives).
 * Falls back to case-insensitive exact name match, then loose substring match.
 */
function gameMatch(
  result: { id: string; name: string },
  target: { name: string; dbGameId?: string },
): boolean {
  // Prefer ID match when available (eliminates "Azul" matching "Azul: Summer Pavilion")
  if (target.dbGameId && result.id) {
    return result.id === target.dbGameId;
  }
  // Fallback: case-insensitive exact name match
  const a = result.name.toLowerCase().trim();
  const b = target.name.toLowerCase().trim();
  if (a === b) return true;
  // Loose fallback: substring match (legacy behavior for cases without IDs)
  return a.includes(b) || b.includes(a);
}

/** @deprecated Use gameMatch() instead */
function nameMatch(gameName: string, targetName: string): boolean {
  const a = gameName.toLowerCase();
  const b = targetName.toLowerCase();
  return a.includes(b) || b.includes(a);
}

function evaluateCase(
  evalCase: EvalCase,
  results: GameResult[],
  violations: ReturnType<typeof checkConstraintViolations>,
  latencyMs: number,
  llmJudge?: { score: number; reasoning: string; violations: string[] } | null,
): CaseResult {
  const topResults = results.slice(0, 10);

  // Check ideal games (using ID-based matching when available)
  const idealGamesFound = evalCase.idealGames
    .filter(ig => topResults.some(r => gameMatch(r, ig)))
    .map(ig => ig.name);
  const idealGamesMissing = evalCase.idealGames
    .filter(ig => ig.relevance >= 2)
    .filter(ig => !topResults.some(r => gameMatch(r, ig)))
    .map(ig => ig.name);

  // Check anti games (using ID-based matching when available)
  const antiGamesFound = evalCase.antiGames
    .filter(ag => topResults.some(r => gameMatch(r, ag)))
    .map(ag => ag.name);

  // Determine failure types
  const failureTypes: FailureType[] = [];
  if (idealGamesMissing.length > 0) failureTypes.push('missing-ideal-game');
  if (antiGamesFound.length > 0) failureTypes.push('anti-game-present');
  if (violations.length > 0) failureTypes.push('constraint-violation');
  if (results.length === 0) failureTypes.push('empty-results');
  if (llmJudge && llmJudge.score < 5) failureTypes.push('llm-judge-low-score');

  // Compute metrics
  const metrics = computeCaseMetrics(results, evalCase, violations.length);

  // A case passes if: no missing ideal games (relevance >= 2), no anti games, no constraint violations in top 5
  const top5Violations = violations.filter(v => v.rank <= 5);
  const passed = idealGamesMissing.length === 0 &&
    antiGamesFound.length === 0 &&
    top5Violations.length === 0 &&
    results.length > 0;

  return {
    caseId: evalCase.id,
    category: evalCase.category,
    query: evalCase.query,
    passed,
    results: results.slice(0, 20),
    idealGamesFound,
    idealGamesMissing,
    antiGamesFound,
    constraintViolations: violations,
    failureTypes,
    llmJudgeScore: llmJudge?.score,
    llmJudgeReason: llmJudge?.reasoning,
    latencyMs,
    metrics,
  };
}

// ─── Aggregate ──────────────────────────────────────────────

function computeAggregateMetrics(cases: CaseResult[]): AggregateMetrics {
  if (cases.length === 0) {
    return {
      avgNdcg10: 0, avgPrecision10: 0, avgMrr: 0, avgHitRate5: 0,
      avgConstraintViolationRate: 0, avgLatencyMs: 0, p50LatencyMs: 0, p95LatencyMs: 0,
    };
  }

  const avg = (fn: (c: CaseResult) => number) =>
    cases.reduce((s, c) => s + fn(c), 0) / cases.length;

  const latencies = cases.map(c => c.latencyMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  const judgedCases = cases.filter(c => c.llmJudgeScore != null);
  const avgJudge = judgedCases.length > 0
    ? judgedCases.reduce((s, c) => s + c.llmJudgeScore!, 0) / judgedCases.length
    : undefined;

  // Catalog coverage: how many unique games appeared across all recommendations
  const uniqueGameIds = new Set<string>();
  for (const c of cases) {
    for (const r of c.results) {
      if (r.id) uniqueGameIds.add(r.id);
    }
  }
  const catalogCoverage = uniqueGameIds.size / 81000; // approximate catalog size

  // Constraint violations by type
  const violationsByType: Record<string, number> = {};
  let trustBusters = 0;
  for (const c of cases) {
    for (const v of c.constraintViolations) {
      violationsByType[v.type] = (violationsByType[v.type] ?? 0) + 1;
    }
    // Trust busters: anti-games found (obviously wrong results)
    trustBusters += c.antiGamesFound.length;
  }

  return {
    avgNdcg10: avg(c => c.metrics.ndcg10),
    avgPrecision10: avg(c => c.metrics.precision10),
    avgMrr: avg(c => c.metrics.mrr),
    avgHitRate5: avg(c => c.metrics.hitRate5),
    avgConstraintViolationRate: avg(c => c.metrics.constraintViolationRate),
    avgLatencyMs: avg(c => c.latencyMs),
    avgLlmJudgeScore: avgJudge,
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    catalogCoverage,
    constraintViolationsByType: violationsByType,
    trustBusterCount: trustBusters,
  };
}

function computeCategoryBreakdown(cases: CaseResult[]): Record<string, CategorySummary> {
  const byCategory = new Map<string, CaseResult[]>();
  for (const c of cases) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category)!.push(c);
  }

  const result: Record<string, CategorySummary> = {};
  for (const [cat, catCases] of byCategory) {
    const passed = catCases.filter(c => c.passed).length;
    result[cat] = {
      totalCases: catCases.length,
      passedCases: passed,
      passRate: passed / catCases.length,
      avgNdcg10: catCases.reduce((s, c) => s + c.metrics.ndcg10, 0) / catCases.length,
      avgMrr: catCases.reduce((s, c) => s + c.metrics.mrr, 0) / catCases.length,
      avgConstraintViolationRate: catCases.reduce((s, c) => s + c.metrics.constraintViolationRate, 0) / catCases.length,
    };
  }
  return result;
}

function computeFailureDistribution(cases: CaseResult[]): Record<FailureType, number> {
  const dist: Record<string, number> = {};
  for (const c of cases) {
    for (const ft of c.failureTypes) {
      dist[ft] = (dist[ft] ?? 0) + 1;
    }
  }
  return dist as Record<FailureType, number>;
}

// ─── Regression Tracking ────────────────────────────────────

function findPreviousRun(): EvalRun | null {
  if (!fs.existsSync(RUNS_DIR)) return null;
  const files = fs.readdirSync(RUNS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(RUNS_DIR, files[0]), 'utf8'));
  } catch {
    return null;
  }
}

function computeRegression(current: CaseResult[], prev: EvalRun): RegressionReport {
  const prevCaseMap = new Map(prev.cases.map(c => [c.caseId, c]));
  const currCaseMap = new Map(current.map(c => [c.caseId, c]));

  const newFailures: string[] = [];
  const fixedFailures: string[] = [];
  const regressions: string[] = [];

  for (const [id, curr] of currCaseMap) {
    const prevCase = prevCaseMap.get(id);
    if (!prevCase) continue;

    if (!curr.passed && prevCase.passed) {
      newFailures.push(`${id}: "${curr.query.slice(0, 50)}" -- was passing, now failing`);
      regressions.push(id);
    }
    if (curr.passed && !prevCase.passed) {
      fixedFailures.push(`${id}: "${curr.query.slice(0, 50)}" -- was failing, now passing`);
    }
  }

  const currPassRate = current.filter(c => c.passed).length / current.length;
  const avgNdcg = current.reduce((s, c) => s + c.metrics.ndcg10, 0) / current.length;
  const avgMrr = current.reduce((s, c) => s + c.metrics.mrr, 0) / current.length;

  return {
    previousRunId: prev.runId,
    passRateDelta: currPassRate - prev.passRate,
    ndcgDelta: avgNdcg - prev.aggregateMetrics.avgNdcg10,
    mrrDelta: avgMrr - prev.aggregateMetrics.avgMrr,
    newFailures,
    fixedFailures,
    regressions,
  };
}

// ─── Reporting ──────────────────────────────────────────────

function formatReport(run: EvalRun): string {
  const lines: string[] = [];
  const bar = '='.repeat(72);
  const thin = '-'.repeat(72);

  lines.push('');
  lines.push(bar);
  lines.push('  BOREDGAME.LOL EVALUATION REPORT');
  lines.push(`  Run ID: ${run.runId}`);
  lines.push(`  ${run.startedAt} -> ${run.finishedAt}`);
  lines.push(`  Duration: ${run.durationSeconds.toFixed(1)}s | Cases: ${run.totalCases} | Concurrency: ${run.config.concurrency}`);
  lines.push(bar);

  // Overall
  lines.push('');
  lines.push('  OVERALL RESULTS');
  lines.push(thin);
  const m = run.aggregateMetrics;
  lines.push(`  Pass Rate:       ${run.passedCases}/${run.totalCases} (${(run.passRate * 100).toFixed(1)}%)`);
  lines.push(`  Avg NDCG@10:     ${m.avgNdcg10.toFixed(4)}`);
  lines.push(`  Avg Precision@10: ${m.avgPrecision10.toFixed(4)}`);
  lines.push(`  Avg MRR:         ${m.avgMrr.toFixed(4)}`);
  lines.push(`  Avg Hit Rate@5:  ${m.avgHitRate5.toFixed(4)}`);
  lines.push(`  Constraint Viol: ${(m.avgConstraintViolationRate * 100).toFixed(1)}%`);
  if (m.avgLlmJudgeScore != null) {
    lines.push(`  LLM Judge Score: ${m.avgLlmJudgeScore.toFixed(2)}/10`);
  }
  lines.push(`  Latency p50/p95: ${m.p50LatencyMs}ms / ${m.p95LatencyMs}ms`);
  if (m.catalogCoverage != null) {
    lines.push(`  Catalog Coverage: ${(m.catalogCoverage * 100).toFixed(1)}% (${Math.round(m.catalogCoverage * 81000)} unique games)`);
  }
  if (m.trustBusterCount != null && m.trustBusterCount > 0) {
    lines.push(`  Trust Busters:   ${m.trustBusterCount} (obviously wrong results)`);
  }
  if (m.constraintViolationsByType && Object.keys(m.constraintViolationsByType).length > 0) {
    const parts = Object.entries(m.constraintViolationsByType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}=${count}`)
      .join(', ');
    lines.push(`  Violations by type: ${parts}`);
  }

  // Regression
  if (run.regression) {
    lines.push('');
    lines.push('  REGRESSION vs ' + run.regression.previousRunId);
    lines.push(thin);
    const r = run.regression;
    const sign = (n: number) => n >= 0 ? `+${n.toFixed(4)}` : n.toFixed(4);
    lines.push(`  Pass Rate Delta: ${sign(r.passRateDelta)}`);
    lines.push(`  NDCG Delta:      ${sign(r.ndcgDelta)}`);
    lines.push(`  MRR Delta:       ${sign(r.mrrDelta)}`);
    if (r.fixedFailures.length > 0) {
      lines.push(`  Fixed (${r.fixedFailures.length}):`);
      for (const f of r.fixedFailures.slice(0, 10)) lines.push(`    + ${f}`);
    }
    if (r.newFailures.length > 0) {
      lines.push(`  New Failures (${r.newFailures.length}):`);
      for (const f of r.newFailures.slice(0, 10)) lines.push(`    - ${f}`);
    }
  }

  // Category breakdown
  lines.push('');
  lines.push('  PER-CATEGORY BREAKDOWN');
  lines.push(thin);
  const cats = Object.entries(run.categoryBreakdown).sort((a, b) => a[1].passRate - b[1].passRate);
  for (const [cat, cs] of cats) {
    lines.push(`  ${cat.padEnd(24)} ${cs.passedCases}/${cs.totalCases} (${(cs.passRate * 100).toFixed(0)}%)  NDCG=${cs.avgNdcg10.toFixed(3)}  MRR=${cs.avgMrr.toFixed(3)}  Violations=${(cs.avgConstraintViolationRate * 100).toFixed(0)}%`);
  }

  // Failure distribution
  lines.push('');
  lines.push('  FAILURE TYPES');
  lines.push(thin);
  const failures = Object.entries(run.failureDistribution).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of failures) {
    lines.push(`  ${type.padEnd(28)} ${count} cases`);
  }

  // Worst cases
  lines.push('');
  lines.push('  WORST 20 CASES');
  lines.push(thin);
  for (const c of run.worstCases.slice(0, 20)) {
    const judgeStr = c.llmJudgeScore != null ? ` Judge=${c.llmJudgeScore}/10` : '';
    const viols = c.constraintViolations.length > 0 ? ` [${c.constraintViolations.length} violations]` : '';
    const missing = c.idealGamesMissing.length > 0 ? ` missing=[${c.idealGamesMissing.join(', ')}]` : '';
    const anti = c.antiGamesFound.length > 0 ? ` BAD=[${c.antiGamesFound.join(', ')}]` : '';
    lines.push(`  [${c.caseId}] "${c.query.slice(0, 45)}"${judgeStr}${viols}${missing}${anti}`);
    lines.push(`    Top 5: ${c.results.slice(0, 5).map(r => r.name).join(' | ')}`);
    if (c.llmJudgeReason) {
      lines.push(`    Judge: ${c.llmJudgeReason.slice(0, 120)}`);
    }
  }

  lines.push('');
  lines.push(bar);
  return lines.join('\n');
}

// ─── Main Runner ────────────────────────────────────────────

export async function runEvalSuite(config: RunConfig): Promise<EvalRun> {
  // Load cases
  if (!fs.existsSync(CASES_FILE)) {
    throw new Error(`Cases file not found: ${CASES_FILE}. Run 'npx tsx evals/generate-cases.ts' first.`);
  }
  let cases: EvalCase[] = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));

  // Apply filters
  if (config.categories?.length) {
    cases = cases.filter(c => config.categories!.includes(c.category));
  }
  if (config.tags?.length) {
    cases = cases.filter(c => c.tags?.some(t => config.tags!.includes(t)));
  }
  if (config.limit) {
    cases = cases.slice(0, config.limit);
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const startedAt = new Date().toISOString();

  console.log(`\n${'='.repeat(72)}`);
  console.log(`  BOREDGAME.LOL EVAL SUITE`);
  console.log(`  Run: ${runId} | Cases: ${cases.length} | Concurrency: ${config.concurrency} | Judge: ${config.useLlmJudge}`);
  console.log(`${'='.repeat(72)}\n`);

  // Run all cases with concurrency
  const caseResults: CaseResult[] = new Array(cases.length);
  let completed = 0;
  let passed = 0;
  let failed = 0;

  await runWithConcurrency(cases, async (evalCase, idx) => {
    // Query the API
    const { results, latencyMs, error } = await queryRecommendAPI(evalCase, config.apiUrl);

    if (error) {
      caseResults[idx] = {
        caseId: evalCase.id,
        category: evalCase.category,
        query: evalCase.query,
        passed: false,
        results: [],
        idealGamesFound: [],
        idealGamesMissing: evalCase.idealGames.filter(ig => ig.relevance >= 2).map(ig => ig.name),
        antiGamesFound: [],
        constraintViolations: [],
        failureTypes: ['api-error'],
        latencyMs,
        metrics: { ndcg10: 0, precision10: 0, mrr: 0, hitRate5: 0, constraintViolationRate: 0 },
      };
      completed++;
      failed++;
      process.stdout.write(`\r  Progress: ${completed}/${cases.length} (${passed} pass, ${failed} fail)`);
      return;
    }

    // Check constraints
    const violations = checkConstraintViolations(results.slice(0, 10), evalCase);

    // Optional LLM judge
    let llmJudge: { score: number; reasoning: string; violations: string[] } | null = null;
    if (config.useLlmJudge) {
      llmJudge = await judgeResults({
        query: evalCase.query,
        gameTypes: evalCase.gameTypes,
        playerCount: evalCase.playerCount,
        constraints: evalCase.constraints,
        results: results.slice(0, 10).map((r, i) => ({
          name: r.name,
          rank: i + 1,
          categories: r.categories,
          mechanics: r.mechanics,
          complexity: r.complexity ?? undefined,
          avgPlayTime: r.avgPlayTime ?? undefined,
          minPlayers: r.minPlayers ?? undefined,
          maxPlayers: r.maxPlayers ?? undefined,
        })),
      });
    }

    // Evaluate
    const caseResult = evaluateCase(evalCase, results, violations, latencyMs, llmJudge);
    caseResults[idx] = caseResult;

    completed++;
    if (caseResult.passed) passed++;
    else failed++;

    process.stdout.write(`\r  Progress: ${completed}/${cases.length} (${passed} pass, ${failed} fail)`);
  }, config.concurrency);

  console.log(''); // newline after progress

  // Filter out any undefined (shouldn't happen but safety)
  const validResults = caseResults.filter(Boolean);

  // Compute aggregates
  const aggregateMetrics = computeAggregateMetrics(validResults);
  const categoryBreakdown = computeCategoryBreakdown(validResults);
  const failureDistribution = computeFailureDistribution(validResults);

  // Sort by worst first for report
  const worstCases = [...validResults]
    .filter(c => !c.passed)
    .sort((a, b) => {
      // Sort by LLM judge score first, then by number of failures
      const aScore = a.llmJudgeScore ?? 5;
      const bScore = b.llmJudgeScore ?? 5;
      if (aScore !== bScore) return aScore - bScore;
      return b.failureTypes.length - a.failureTypes.length;
    });

  // Regression check
  const prevRun = findPreviousRun();
  const regression = prevRun ? computeRegression(validResults, prevRun) : undefined;

  const finishedAt = new Date().toISOString();
  const durationSeconds = (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000;

  const run: EvalRun = {
    runId,
    startedAt,
    finishedAt,
    durationSeconds,
    totalCases: validResults.length,
    passedCases: passed,
    failedCases: failed,
    passRate: validResults.length > 0 ? passed / validResults.length : 0,
    aggregateMetrics,
    categoryBreakdown,
    failureDistribution,
    worstCases: worstCases.slice(0, 20),
    cases: validResults,
    config,
    regression,
  };

  // Save results
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.mkdirSync(LOGS_DIR, { recursive: true });

  const runFile = path.join(RUNS_DIR, `${runId}.json`);
  fs.writeFileSync(runFile, JSON.stringify(run, null, 2));

  // Save human-readable log
  const report = formatReport(run);
  const logFile = path.join(LOGS_DIR, `${runId}.log`);
  fs.writeFileSync(logFile, report);

  // Print report
  console.log(report);
  console.log(`\n  Results saved to: ${runFile}`);
  console.log(`  Log saved to: ${logFile}`);

  // Regression gate (if previous run exists)
  if (prevRun) {
    const gate = checkRegressionGate(run, prevRun);
    console.log('\n' + gate.summary);
    // Append gate result to log
    fs.appendFileSync(logFile, '\n\n' + gate.summary);
  }

  // Append to metrics history (Phase 2.1)
  const historyFile = path.join(EVALS_DIR, 'history.json');
  const history: any[] = fs.existsSync(historyFile)
    ? JSON.parse(fs.readFileSync(historyFile, 'utf8'))
    : [];
  history.push({
    runId: run.runId,
    timestamp: run.startedAt,
    totalCases: run.totalCases,
    passRate: run.passRate,
    ndcg10: run.aggregateMetrics.avgNdcg10,
    mrr: run.aggregateMetrics.avgMrr,
    llmJudge: run.aggregateMetrics.avgLlmJudgeScore ?? null,
    catalogCoverage: run.aggregateMetrics.catalogCoverage ?? null,
    constraintViolations: run.aggregateMetrics.constraintViolationsByType ?? {},
    trustBusters: run.aggregateMetrics.trustBusterCount ?? 0,
    p50Latency: run.aggregateMetrics.p50LatencyMs,
    p95Latency: run.aggregateMetrics.p95LatencyMs,
    categoryPassRates: Object.fromEntries(
      Object.entries(run.categoryBreakdown).map(([k, v]) => [k, v.passRate]),
    ),
  });
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2) + '\n');
  console.log(`  History appended to: ${historyFile}`);

  return run;
}

// ─── CLI Entry Point ────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  const getArg = (name: string): string | undefined => {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    return arg?.split('=')[1];
  };

  const config: RunConfig = {
    apiUrl: process.env.EVAL_API_URL ?? 'http://localhost:1337',
    concurrency: parseInt(getArg('concurrency') ?? '8', 10),
    useLlmJudge: !args.includes('--no-judge') && !args.includes('--quick'),
    categories: getArg('category')?.split(',') as EvalCategory[] | undefined,
    tags: getArg('tag')?.split(','),
    limit: getArg('limit') ? parseInt(getArg('limit')!, 10) : undefined,
  };

  if (args.includes('--quick')) {
    config.limit = config.limit ?? 50;
    config.useLlmJudge = false;
  }

  await runEvalSuite(config);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
