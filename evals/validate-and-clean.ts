/**
 * Validate and Clean Eval Cases
 *
 * Removes eval cases that are structurally broken:
 * - Cases where ALL critical idealGames (relevance >= 2) have no dbGameId
 *   (meaning those games don't exist in the database and the case always fails)
 * - Cases with zero idealGames
 *
 * Also removes individual idealGames/antiGames entries that reference
 * non-existent games (no dbGameId after resolution).
 *
 * Reports per-category case counts after cleanup.
 *
 * Usage:
 *   npx tsx evals/validate-and-clean.ts              # Dry run
 *   npx tsx evals/validate-and-clean.ts --write       # Write cleaned cases
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EvalCase, EvalCategory } from './types';

const CASES_FILE = path.join(process.cwd(), 'evals', 'cases.json');

function main() {
  const shouldWrite = process.argv.includes('--write');

  const cases: EvalCase[] = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));
  console.log(`Loaded ${cases.length} eval cases\n`);

  // Pre-cleanup category counts
  const preCounts = new Map<string, number>();
  for (const c of cases) {
    preCounts.set(c.category, (preCounts.get(c.category) ?? 0) + 1);
  }

  // Step 1: Remove individual idealGames/antiGames entries without dbGameId
  // (these reference games that don't exist in the DB)
  let removedIdealEntries = 0;
  let removedAntiEntries = 0;

  for (const c of cases) {
    const beforeIdeal = c.idealGames.length;
    // Only remove entries without dbGameId that have relevance >= 2 (critical)
    // Keep entries with dbGameId (resolved) or low relevance (nice-to-have)
    // Actually, remove ALL entries without dbGameId since they can't be matched reliably
    const cleanedIdeal = c.idealGames.filter(ig => ig.dbGameId);
    removedIdealEntries += beforeIdeal - cleanedIdeal.length;
    c.idealGames = cleanedIdeal;

    const beforeAnti = c.antiGames.length;
    c.antiGames = c.antiGames.filter(ag => ag.dbGameId);
    removedAntiEntries += beforeAnti - c.antiGames.length;
  }

  console.log(`Removed ${removedIdealEntries} idealGame entries without DB IDs`);
  console.log(`Removed ${removedAntiEntries} antiGame entries without DB IDs`);

  // Step 2: Remove cases that are now structurally broken
  // A case is broken if it has zero idealGames (nothing to test)
  // EXCEPT: edge-case and regression categories test for stability/non-crash,
  // not specific game results, so keep them even without idealGames
  const KEEP_WITHOUT_IDEALS: EvalCategory[] = ['edge-case', 'regression'];
  const cleaned = cases.filter(c =>
    c.idealGames.length > 0 || KEEP_WITHOUT_IDEALS.includes(c.category)
  );
  const removedCases = cases.length - cleaned.length;

  console.log(`\nRemoved ${removedCases} cases with no remaining idealGames`);
  console.log(`Remaining: ${cleaned.length} cases\n`);

  // Post-cleanup category counts
  const postCounts = new Map<string, number>();
  for (const c of cleaned) {
    postCounts.set(c.category, (postCounts.get(c.category) ?? 0) + 1);
  }

  // Report
  const bar = '='.repeat(70);
  console.log(bar);
  console.log('  CATEGORY BREAKDOWN (before -> after cleanup)');
  console.log(bar);

  const allCats = new Set([...preCounts.keys(), ...postCounts.keys()]);
  const thinCategories: string[] = [];

  for (const cat of [...allCats].sort()) {
    const pre = preCounts.get(cat) ?? 0;
    const post = postCounts.get(cat) ?? 0;
    const delta = post - pre;
    const deltaStr = delta === 0 ? '' : ` (${delta})`;
    const warning = post < 30 ? ' ⚠ THIN (need 30+ for significance)' : '';
    console.log(`  ${cat.padEnd(24)} ${pre.toString().padStart(4)} -> ${post.toString().padStart(4)}${deltaStr}${warning}`);
    if (post < 30) thinCategories.push(cat);
  }

  console.log(bar);
  console.log(`  Total: ${cases.length} -> ${cleaned.length}`);

  if (thinCategories.length > 0) {
    console.log(`\n  Categories needing more cases: ${thinCategories.join(', ')}`);
  }

  if (shouldWrite) {
    fs.writeFileSync(CASES_FILE, JSON.stringify(cleaned, null, 2) + '\n');
    console.log(`\nWrote ${cleaned.length} cleaned cases to ${CASES_FILE}`);
  } else {
    console.log(`\nDry run. Use --write to save cleaned cases.`);
  }
}

main();
