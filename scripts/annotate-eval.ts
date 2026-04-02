/**
 * Eval Annotation Helper
 *
 * Runs each golden eval case against the recommendation API,
 * collects top-20 results with game attributes, and outputs
 * a file ready for human annotation of graded relevance (0-3).
 *
 * Usage: source .env.local && npx tsx scripts/annotate-eval.ts
 *
 * Output: scripts/annotation-worksheet.json
 * Human reviews this file, adds relevance scores, and it becomes
 * the ground truth for NDCG/MAP/MRR evaluation.
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const API_URL = process.env.EVAL_API_URL ?? 'http://localhost:1337';
const GOLDEN_FILE = 'scripts/golden-eval-cases.json';
const OUTPUT_FILE = 'scripts/annotation-worksheet.json';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

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
  annotations: any[];
}

interface AnnotationEntry {
  caseId: string;
  category: string;
  query: string;
  constraints: Record<string, any>;
  results: {
    rank: number;
    gameId: string;
    gameName: string;
    categories: string[];
    mechanics: string[];
    minPlayers: number | null;
    maxPlayers: number | null;
    avgPlayTime: number | null;
    complexity: number | null;
    rating: number | null;
    ratingCount: number | null;
    /** Pre-filled from idealGames/antiGames, or null for human annotation */
    relevance: number | null;
    /** Auto-detected constraint violations */
    constraintViolations: string[];
  }[];
  /** Games from idealGames that did NOT appear in results */
  missingIdealGames: string[];
}

async function runQuery(goldenCase: GoldenCase): Promise<any[]> {
  try {
    const body: Record<string, any> = {
      _nocache: true,
      gameTypes: goldenCase.gameTypes ?? [],
      playerCount: goldenCase.playerCount ?? { min: 1, max: 10 },
      timePresets: goldenCase.timePresets ?? [],
      complexity: { min: 1, max: 5 },
      genres: [],
      moods: [],
      freeText: goldenCase.query,
    };

    const res = await fetch(`${API_URL}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).slice(0, 20);
  } catch {
    return [];
  }
}

function checkConstraintViolations(
  game: any,
  constraints: Record<string, any>,
  playerCount?: { min: number; max: number },
): string[] {
  const violations: string[] = [];

  // Player count violation
  if (playerCount) {
    const gameMin = game.playerCount?.min ?? game.min_players;
    const gameMax = game.playerCount?.max ?? game.max_players;
    if (gameMin != null && gameMax != null) {
      if (gameMin > playerCount.max) {
        violations.push(`Player count: game needs min ${gameMin}, user wants max ${playerCount.max}`);
      }
      if (gameMax < playerCount.min) {
        violations.push(`Player count: game supports max ${gameMax}, user wants min ${playerCount.min}`);
      }
    }
  }

  // Time violation
  if (constraints?.maxMinutes) {
    const gameTime = game.playTime?.average ?? game.avg_play_time ?? game.playTime?.max ?? game.max_play_time;
    if (gameTime != null && gameTime > constraints.maxMinutes * 1.15) { // 15% grace
      violations.push(`Time: game takes ${gameTime}min, user wants max ${constraints.maxMinutes}min`);
    }
  }

  // Complexity violation
  if (constraints?.complexity) {
    const gameCx = game.complexity;
    if (gameCx != null) {
      if (constraints.complexity.max && gameCx > constraints.complexity.max + 0.5) {
        violations.push(`Complexity: game is ${gameCx}, user wants max ${constraints.complexity.max}`);
      }
      if (constraints.complexity.min && gameCx < constraints.complexity.min - 0.5) {
        violations.push(`Complexity: game is ${gameCx}, user wants min ${constraints.complexity.min}`);
      }
    }
  }

  return violations;
}

async function main() {
  const golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
  const cases: GoldenCase[] = golden.cases;

  console.log(`\nAnnotation Helper for boredgame.lol Eval Suite`);
  console.log(`  API: ${API_URL}`);
  console.log(`  Cases: ${cases.length}\n`);

  const worksheet: AnnotationEntry[] = [];

  for (const gc of cases) {
    process.stdout.write(`  [${gc.id}] "${gc.query.slice(0, 50)}..."  `);

    const results = await runQuery(gc);
    console.log(`${results.length} results`);

    // Build known relevance map from idealGames and antiGames
    const knownRelevance = new Map<string, number>();
    for (const g of gc.idealGames) knownRelevance.set(g.name.toLowerCase(), g.relevance);
    for (const g of gc.antiGames) knownRelevance.set(g.name.toLowerCase(), g.relevance);

    const entry: AnnotationEntry = {
      caseId: gc.id,
      category: gc.category,
      query: gc.query,
      constraints: {
        ...(gc.constraints ?? {}),
        ...(gc.playerCount ? { playerCount: gc.playerCount } : {}),
        ...(gc.timePresets ? { timePresets: gc.timePresets } : {}),
      },
      results: results.map((r: any, i: number) => {
        const name = r.name ?? '';
        const nameLower = name.toLowerCase();

        // Check if we have a pre-annotated relevance
        let relevance: number | null = null;
        for (const [known, rel] of knownRelevance) {
          if (nameLower.includes(known) || known.includes(nameLower)) {
            relevance = rel;
            break;
          }
        }

        const violations = checkConstraintViolations(r, gc.constraints ?? {}, gc.playerCount);

        return {
          rank: i + 1,
          gameId: r.id ?? '',
          gameName: name,
          categories: r.categories ?? [],
          mechanics: r.mechanics ?? [],
          minPlayers: r.playerCount?.min ?? null,
          maxPlayers: r.playerCount?.max ?? null,
          avgPlayTime: r.playTime?.average ?? null,
          complexity: r.complexity ?? null,
          rating: r.rating ?? null,
          ratingCount: r.ratingCount ?? null,
          relevance,
          constraintViolations: violations,
        };
      }),
      missingIdealGames: gc.idealGames
        .filter(ig => !results.some((r: any) =>
          (r.name ?? '').toLowerCase().includes(ig.name.toLowerCase())
        ))
        .map(ig => ig.name),
    };

    worksheet.push(entry);
  }

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(worksheet, null, 2));

  // Summary
  const totalResults = worksheet.reduce((sum, w) => sum + w.results.length, 0);
  const totalViolations = worksheet.reduce((sum, w) =>
    sum + w.results.filter(r => r.constraintViolations.length > 0).length, 0);
  const totalMissing = worksheet.reduce((sum, w) => sum + w.missingIdealGames.length, 0);
  const preAnnotated = worksheet.reduce((sum, w) =>
    sum + w.results.filter(r => r.relevance !== null).length, 0);
  const needsAnnotation = totalResults - preAnnotated;

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`\nANNOTATION WORKSHEET SUMMARY`);
  console.log(`  Total results collected: ${totalResults}`);
  console.log(`  Pre-annotated (from idealGames/antiGames): ${preAnnotated}`);
  console.log(`  Needs human annotation: ${needsAnnotation}`);
  console.log(`  Constraint violations detected: ${totalViolations}`);
  console.log(`  Missing ideal games (not in results): ${totalMissing}`);
  console.log(`\n  Output: ${OUTPUT_FILE}`);
  console.log(`  Open this file, review each result, and set relevance to 0-3.`);
  console.log(`  Then run the eval suite against this annotated dataset.\n`);

  // Show worst cases
  const violationCases = worksheet.filter(w =>
    w.results.some(r => r.constraintViolations.length > 0)
  );
  if (violationCases.length > 0) {
    console.log(`CASES WITH CONSTRAINT VIOLATIONS (${violationCases.length}):`);
    for (const w of violationCases) {
      const violatingResults = w.results.filter(r => r.constraintViolations.length > 0);
      console.log(`  [${w.caseId}] "${w.query.slice(0, 50)}"`);
      for (const r of violatingResults.slice(0, 3)) {
        console.log(`    #${r.rank} ${r.gameName}: ${r.constraintViolations[0]}`);
      }
    }
  }

  const missingCases = worksheet.filter(w => w.missingIdealGames.length > 0);
  if (missingCases.length > 0) {
    console.log(`\nCASES WITH MISSING IDEAL GAMES (${missingCases.length}):`);
    for (const w of missingCases) {
      console.log(`  [${w.caseId}] "${w.query.slice(0, 50)}": missing ${w.missingIdealGames.join(', ')}`);
    }
  }
}

main().catch(console.error);
