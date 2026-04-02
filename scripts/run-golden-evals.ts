/**
 * Golden Evaluation Suite Runner
 *
 * Runs the golden eval dataset (hand-curated queries with graded relevance)
 * against the recommendation API and computes research-standard metrics:
 * NDCG@10, MAP@10, MRR, ILD (diversity), Novelty, Coverage.
 *
 * Also runs baselines (random, popularity, keyword) for comparison.
 *
 * Usage:
 *   npx tsx scripts/run-golden-evals.ts                     # Full run
 *   npx tsx scripts/run-golden-evals.ts --baseline=popularity # Baseline only
 *   EVAL_LIMIT=10 npx tsx scripts/run-golden-evals.ts       # Subset
 *
 * Requires: dev server running on localhost:1337
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  type GradedResult,
  type EvalMetrics,
  computeQueryMetrics,
  averageMetrics,
  formatMetrics,
} from './eval-metrics';
import { randomBaseline, popularityBaseline, keywordBaseline } from './baselines';

dotenv.config({ path: '.env.local' });

const API_URL = process.env.EVAL_API_URL ?? 'http://localhost:1337';
const GOLDEN_FILE = 'scripts/golden-eval-cases.json';
const RESULTS_FILE = 'scripts/golden-eval-results.json';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

// ─── Types ───────────────────────────────────────────────────

interface GoldenCase {
  id: string;
  category: string;
  query: string;
  gameTypes?: string[];
  playerCount?: { min: number; max: number };
  timePresets?: string[];
  constraints?: Record<string, any>;
  idealGames: { name: string; relevance: number; reason?: string }[];
  antiGames: { name: string; relevance: number; reason?: string }[];
  annotations: { gameName: string; relevance: number }[];
  note?: string;
}

interface CaseResult {
  caseId: string;
  category: string;
  query: string;
  metrics: EvalMetrics;
  topResults: string[];
  constraintViolations: number;
  missingIdealGames: string[];
  duration: number;
}

// ─── Query Runner ────────────────────────────────────────────

async function runRecommendQuery(gc: GoldenCase): Promise<any[]> {
  const res = await fetch(`${API_URL}/api/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      _nocache: true,
      gameTypes: gc.gameTypes ?? [],
      playerCount: gc.playerCount ?? { min: 1, max: 10 },
      timePresets: gc.timePresets ?? [],
      complexity: { min: 1, max: 5 },
      genres: [],
      moods: [],
      freeText: gc.query,
    }),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).slice(0, 20);
}

// ─── Relevance Assignment ────────────────────────────────────

function assignRelevance(
  results: any[],
  gc: GoldenCase,
): { graded: GradedResult[]; violations: number; missing: string[] } {
  // Build known relevance map
  const knownRelevance = new Map<string, number>();
  for (const g of gc.idealGames) knownRelevance.set(g.name.toLowerCase(), g.relevance);
  for (const g of gc.antiGames) knownRelevance.set(g.name.toLowerCase(), g.relevance);
  for (const a of gc.annotations) knownRelevance.set(a.gameName.toLowerCase(), a.relevance);

  let violations = 0;

  const graded: GradedResult[] = results.map((r: any) => {
    const name = (r.name ?? '').toLowerCase();

    // Try to find known relevance via substring matching
    let relevance: 0 | 1 | 2 | 3 = 0;
    for (const [known, rel] of knownRelevance) {
      if (name.includes(known) || known.includes(name)) {
        relevance = rel as 0 | 1 | 2 | 3;
        break;
      }
    }

    // If not in known set, assign heuristic relevance based on constraints
    if (relevance === 0 && !knownRelevance.has(name)) {
      // For unannotated results, give benefit of doubt: 1 (partial match)
      // unless it violates a constraint
      relevance = 1;
    }

    // Check constraint violations
    const cvs = checkViolations(r, gc);
    if (cvs > 0) {
      violations += cvs;
      relevance = 0; // Constraint-violating results get 0 relevance
    }

    const tags = [
      ...(r.categories ?? []),
      ...(r.mechanics ?? []),
      ...(r.themes ?? []),
    ];

    return {
      gameId: r.id ?? '',
      gameName: r.name ?? '',
      relevance,
      tags,
      ratingCount: r.ratingCount ?? r.rating_count ?? 0,
    };
  });

  // Find missing ideal games
  const missing = gc.idealGames
    .filter(ig => ig.relevance >= 2) // Only track games rated 2+ as "missing"
    .filter(ig => !results.some((r: any) =>
      (r.name ?? '').toLowerCase().includes(ig.name.toLowerCase())
    ))
    .map(ig => ig.name);

  return { graded, violations, missing };
}

function checkViolations(game: any, gc: GoldenCase): number {
  let violations = 0;
  const pc = gc.playerCount;
  const constraints = gc.constraints ?? {};

  // Player count
  if (pc) {
    const gMin = game.playerCount?.min ?? game.min_players;
    const gMax = game.playerCount?.max ?? game.max_players;
    if (gMin != null && gMax != null) {
      if (gMin > pc.max || gMax < pc.min) violations++;
    }
  }

  // Time
  if (constraints.maxMinutes) {
    const gTime = game.playTime?.average ?? game.avg_play_time ??
                  game.playTime?.max ?? game.max_play_time;
    if (gTime != null) {
      const buffer = constraints.timeStrictness === 'hard' ? 1.15 : 1.5;
      if (gTime > constraints.maxMinutes * buffer) violations++;
    }
  }

  // Complexity
  if (constraints.complexity) {
    const gCx = game.complexity;
    if (gCx != null) {
      if (constraints.complexity.max && gCx > constraints.complexity.max + 0.5) violations++;
      if (constraints.complexity.min && gCx < constraints.complexity.min - 0.5) violations++;
    }
  }

  return violations;
}

// ─── Baseline Runner ─────────────────────────────────────────

async function runBaseline(
  baselineType: 'random' | 'popularity' | 'keyword',
  gc: GoldenCase,
): Promise<any[]> {
  switch (baselineType) {
    case 'random':
      return randomBaseline(gc.gameTypes, 10);
    case 'popularity':
      return popularityBaseline(gc.gameTypes, gc.playerCount, 10);
    case 'keyword':
      return keywordBaseline(gc.query, gc.gameTypes, 10);
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const baselineMode = args.find(a => a.startsWith('--baseline='))?.split('=')[1] as
    'random' | 'popularity' | 'keyword' | undefined;

  const golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
  let cases: GoldenCase[] = golden.cases;

  const limit = parseInt(process.env.EVAL_LIMIT ?? '0', 10);
  if (limit > 0) cases = cases.slice(0, limit);

  // Get max rating count for novelty calculation
  const supabase = getSupabase();
  const { data: maxRow } = await supabase
    .from('games')
    .select('rating_count')
    .order('rating_count', { ascending: false })
    .limit(1)
    .single();
  const maxRatingCount = maxRow?.rating_count ?? 100000;

  const mode = baselineMode ?? 'engine';
  console.log(`\nboredgame.lol Golden Evaluation Suite`);
  console.log(`  Mode: ${mode}`);
  console.log(`  API: ${API_URL}`);
  console.log(`  Cases: ${cases.length}`);
  console.log(`  Max rating count: ${maxRatingCount}\n`);
  console.log('─'.repeat(70));

  const allCaseMetrics: EvalMetrics[] = [];
  const caseResults: CaseResult[] = [];
  const categoryMetrics = new Map<string, EvalMetrics[]>();
  const uniqueGames = new Set<string>();

  for (const gc of cases) {
    const start = Date.now();
    process.stdout.write(`  [${gc.id}] "${gc.query.slice(0, 45)}"...  `);

    let results: any[];
    if (baselineMode) {
      results = await runBaseline(baselineMode, gc);
    } else {
      results = await runRecommendQuery(gc);
    }

    // Track unique games for coverage
    for (const r of results) {
      if (r.id) uniqueGames.add(r.id);
    }

    // Assign relevance and check constraints
    const { graded, violations, missing } = assignRelevance(results, gc);

    // Count total relevant items (from idealGames + annotations)
    const totalRelevant = gc.idealGames.filter(g => g.relevance >= 1).length +
                          gc.annotations.filter(a => a.relevance >= 1).length;

    // Compute metrics
    const metrics = computeQueryMetrics(
      graded, 10, Math.max(totalRelevant, 1), maxRatingCount, violations,
    );
    allCaseMetrics.push(metrics);

    // Track by category
    if (!categoryMetrics.has(gc.category)) categoryMetrics.set(gc.category, []);
    categoryMetrics.get(gc.category)!.push(metrics);

    const duration = Date.now() - start;
    const ndcgStr = metrics.ndcg.toFixed(3);
    const violStr = violations > 0 ? ` [${violations} violations]` : '';
    const missingStr = missing.length > 0 ? ` [missing: ${missing.join(', ')}]` : '';
    console.log(`NDCG=${ndcgStr}${violStr}${missingStr} (${duration}ms)`);

    caseResults.push({
      caseId: gc.id,
      category: gc.category,
      query: gc.query,
      metrics,
      topResults: results.slice(0, 5).map((r: any) => r.name ?? 'Unknown'),
      constraintViolations: violations,
      missingIdealGames: missing,
      duration,
    });
  }

  // Aggregate metrics
  const overall = averageMetrics(allCaseMetrics);
  const coverage = uniqueGames.size / 81000; // approximate catalog size

  console.log('\n' + '─'.repeat(70));
  console.log(`\n${formatMetrics(overall, `${mode.toUpperCase()} - Overall (${cases.length} queries)`)}`);
  console.log(`  Coverage:     ${(coverage * 100).toFixed(1)}% of catalog`);

  // Per-category breakdown
  console.log('\n' + '─'.repeat(70));
  console.log('\nPer-Category Breakdown:');
  for (const [cat, metrics] of categoryMetrics) {
    const avg = averageMetrics(metrics);
    console.log(`  ${cat} (${metrics.length} cases): NDCG=${avg.ndcg.toFixed(3)}  MAP=${avg.map.toFixed(3)}  MRR=${avg.mrr.toFixed(3)}  Violations=${(avg.constraintViolationRate * 100).toFixed(0)}%`);
  }

  // Worst queries
  const sorted = caseResults.sort((a, b) => a.metrics.ndcg - b.metrics.ndcg);
  console.log('\n' + '─'.repeat(70));
  console.log('\nWorst 10 Queries (lowest NDCG):');
  for (const r of sorted.slice(0, 10)) {
    console.log(`  [${r.caseId}] NDCG=${r.metrics.ndcg.toFixed(3)} "${r.query.slice(0, 50)}" -> ${r.topResults.slice(0, 3).join(', ')}`);
  }

  // Save full results
  const output = {
    timestamp: new Date().toISOString(),
    mode,
    caseCount: cases.length,
    overall,
    coverage,
    byCategory: Object.fromEntries(
      [...categoryMetrics.entries()].map(([cat, m]) => [cat, averageMetrics(m)])
    ),
    cases: caseResults,
  };
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(output, null, 2));
  console.log(`\nFull results saved to ${RESULTS_FILE}`);
}

main().catch(console.error);
