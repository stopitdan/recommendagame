/**
 * Resolve Game IDs for Eval Cases
 *
 * Queries the Supabase database to resolve game names in eval cases
 * to their actual database IDs. Picks the highest-ratingCount match
 * for ambiguous names (e.g., "Terraforming Mars" -> bgg-167791).
 *
 * Usage:
 *   npx tsx evals/resolve-game-ids.ts              # Dry run (report only)
 *   npx tsx evals/resolve-game-ids.ts --write       # Write resolved IDs to cases.json
 *   npx tsx evals/resolve-game-ids.ts --report      # Detailed report of missing/ambiguous games
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { EvalCase } from './types';

dotenv.config({ path: '.env.local' });

const CASES_FILE = path.join(process.cwd(), 'evals', 'cases.json');

interface DBGame {
  id: string;
  name: string;
  rating_count: number;
}

async function main() {
  const args = process.argv.slice(2);
  const shouldWrite = args.includes('--write');
  const showReport = args.includes('--report') || !shouldWrite;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Load eval cases
  const cases: EvalCase[] = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));

  // Collect all unique game names from idealGames and antiGames
  const gameNames = new Set<string>();
  for (const c of cases) {
    for (const ig of c.idealGames) gameNames.add(ig.name);
    for (const ag of c.antiGames) gameNames.add(ag.name);
  }

  console.log(`Found ${gameNames.size} unique game names across ${cases.length} eval cases`);

  // Resolve each name against the database
  const resolvedIds = new Map<string, string>();       // name -> best DB ID
  const missingGames: string[] = [];                   // names not found
  const ambiguousGames: { name: string; matches: DBGame[] }[] = [];

  let resolved = 0;
  const nameList = [...gameNames];

  // Process in batches to avoid query limits
  for (let i = 0; i < nameList.length; i += 20) {
    const batch = nameList.slice(i, i + 20);

    for (const gameName of batch) {
      // Try exact match first (case-insensitive)
      const { data: exactMatches } = await supabase
        .from('games')
        .select('id, name, rating_count')
        .ilike('name', gameName)
        .order('rating_count', { ascending: false })
        .limit(5);

      if (exactMatches && exactMatches.length > 0) {
        resolvedIds.set(gameName, exactMatches[0].id);
        if (exactMatches.length > 1) {
          ambiguousGames.push({ name: gameName, matches: exactMatches as DBGame[] });
        }
        resolved++;
        continue;
      }

      // Try fuzzy match (name contains)
      const { data: fuzzyMatches } = await supabase
        .from('games')
        .select('id, name, rating_count')
        .ilike('name', `%${gameName}%`)
        .order('rating_count', { ascending: false })
        .limit(5);

      if (fuzzyMatches && fuzzyMatches.length > 0) {
        // Only use fuzzy if the match is close (name length within 50% difference)
        const best = fuzzyMatches[0];
        const lenRatio = Math.min(gameName.length, best.name.length) / Math.max(gameName.length, best.name.length);
        if (lenRatio > 0.5) {
          resolvedIds.set(gameName, best.id);
          if (fuzzyMatches.length > 1) {
            ambiguousGames.push({ name: gameName, matches: fuzzyMatches as DBGame[] });
          }
          resolved++;
          continue;
        }
      }

      missingGames.push(gameName);
    }

    // Progress
    process.stdout.write(`\r  Resolved ${resolved}/${gameNames.size} games...`);
  }
  console.log('');

  // Report
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  RESOLUTION REPORT`);
  console.log(`${'='.repeat(70)}`);
  console.log(`  Total names:    ${gameNames.size}`);
  console.log(`  Resolved:       ${resolved} (${(resolved / gameNames.size * 100).toFixed(1)}%)`);
  console.log(`  Missing:        ${missingGames.length}`);
  console.log(`  Ambiguous:      ${ambiguousGames.length}`);

  if (showReport) {
    if (missingGames.length > 0) {
      console.log(`\n  MISSING GAMES (not found in DB):`);
      console.log(`  ${'-'.repeat(66)}`);
      for (const name of missingGames.sort()) {
        console.log(`  - ${name}`);
      }
    }

    if (ambiguousGames.length > 0) {
      console.log(`\n  AMBIGUOUS GAMES (multiple matches, picked highest ratingCount):`);
      console.log(`  ${'-'.repeat(66)}`);
      for (const { name, matches } of ambiguousGames.slice(0, 30)) {
        console.log(`  "${name}" -> ${matches[0].id} (${matches[0].rating_count} ratings)`);
        for (const m of matches.slice(1, 3)) {
          console.log(`      also: ${m.id} "${m.name}" (${m.rating_count} ratings)`);
        }
      }
      if (ambiguousGames.length > 30) {
        console.log(`  ... and ${ambiguousGames.length - 30} more`);
      }
    }
  }

  // Count affected cases
  let casesWithMissingGames = 0;
  let casesFullyBroken = 0;
  const missingSet = new Set(missingGames);

  for (const c of cases) {
    const criticalIdealGames = c.idealGames.filter(ig => ig.relevance >= 2);
    const hasMissing = criticalIdealGames.some(ig => missingSet.has(ig.name));
    const allMissing = criticalIdealGames.length > 0 &&
      criticalIdealGames.every(ig => missingSet.has(ig.name));

    if (hasMissing) casesWithMissingGames++;
    if (allMissing) casesFullyBroken++;
  }

  console.log(`\n  IMPACT ON EVAL CASES:`);
  console.log(`  Cases with missing games:    ${casesWithMissingGames}`);
  console.log(`  Cases fully broken:          ${casesFullyBroken} (all critical idealGames missing)`);
  console.log(`${'='.repeat(70)}`);

  // Write resolved IDs back to cases
  if (shouldWrite) {
    let updated = 0;
    for (const c of cases) {
      for (const ig of c.idealGames) {
        const id = resolvedIds.get(ig.name);
        if (id && !ig.dbGameId) {
          ig.dbGameId = id;
          updated++;
        }
      }
      for (const ag of c.antiGames) {
        const id = resolvedIds.get(ag.name);
        if (id && !ag.dbGameId) {
          ag.dbGameId = id;
          updated++;
        }
      }
    }

    fs.writeFileSync(CASES_FILE, JSON.stringify(cases, null, 2) + '\n');
    console.log(`\nWrote ${updated} game IDs to ${CASES_FILE}`);
  } else {
    console.log(`\nDry run. Use --write to save resolved IDs to cases.json`);
  }
}

main().catch(console.error);
