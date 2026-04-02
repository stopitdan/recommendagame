/**
 * Validate Eval Cases Against Database
 *
 * Checks if every game referenced in eval-cases.json and the hardcoded
 * EVAL_CASES actually exists in our games table. Reports:
 * - Games that exist (exact or fuzzy match)
 * - Games that DON'T exist (eval cases referencing these are invalid)
 * - Ambiguous matches (multiple games match)
 *
 * Usage: source .env.local && npx tsx scripts/validate-eval-cases.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const CASES_FILE = 'scripts/eval-cases.json';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

interface EvalCase {
  name: string;
  query: string;
  gameTypes?: string[];
  shouldInclude: string[];
  shouldNotInclude: string[];
  topN?: number;
}

async function main() {
  const supabase = getSupabase();

  // Load all eval cases
  let allCases: EvalCase[] = [];
  if (fs.existsSync(CASES_FILE)) {
    const generated = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));
    allCases = [...generated];
    console.log(`Loaded ${generated.length} cases from ${CASES_FILE}`);
  }

  // Collect all unique game names
  const gameNames = new Set<string>();
  for (const c of allCases) {
    for (const g of c.shouldInclude ?? []) gameNames.add(g);
    for (const g of c.shouldNotInclude ?? []) gameNames.add(g);
  }

  console.log(`\nUnique games to validate: ${gameNames.size}\n`);

  // Check each game against the database
  const found: Map<string, { id: string; name: string; ratingCount: number }[]> = new Map();
  const notFound: string[] = [];
  const ambiguous: Map<string, { id: string; name: string }[]> = new Map();

  let checked = 0;
  for (const gameName of gameNames) {
    checked++;
    if (checked % 50 === 0) {
      process.stdout.write(`  Checked ${checked}/${gameNames.size}...\r`);
    }

    // Try exact match first (case-insensitive)
    const { data: exact } = await supabase
      .from('games')
      .select('id, name, rating_count')
      .ilike('name', gameName)
      .limit(5);

    if (exact && exact.length === 1) {
      found.set(gameName, exact.map(g => ({
        id: g.id,
        name: g.name,
        ratingCount: g.rating_count ?? 0,
      })));
      continue;
    }

    if (exact && exact.length > 1) {
      ambiguous.set(gameName, exact.map(g => ({ id: g.id, name: g.name })));
      // Still "found" -- just ambiguous
      found.set(gameName, exact.map(g => ({
        id: g.id,
        name: g.name,
        ratingCount: g.rating_count ?? 0,
      })));
      continue;
    }

    // Try substring match (the eval runner uses .includes() so this mirrors that)
    const { data: fuzzy } = await supabase
      .from('games')
      .select('id, name, rating_count')
      .ilike('name', `%${gameName}%`)
      .order('rating_count', { ascending: false })
      .limit(10);

    if (fuzzy && fuzzy.length > 0) {
      found.set(gameName, fuzzy.map(g => ({
        id: g.id,
        name: g.name,
        ratingCount: g.rating_count ?? 0,
      })));
      if (fuzzy.length > 1) {
        ambiguous.set(gameName, fuzzy.slice(0, 5).map(g => ({ id: g.id, name: g.name })));
      }
    } else {
      notFound.push(gameName);
    }
  }

  // Report
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`\nVALIDATION RESULTS`);
  console.log(`  Total games checked: ${gameNames.size}`);
  console.log(`  Found in database: ${found.size}`);
  console.log(`  NOT found: ${notFound.length}`);
  console.log(`  Ambiguous matches: ${ambiguous.size}`);

  if (notFound.length > 0) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`\nGAMES NOT FOUND IN DATABASE (${notFound.length}):`);
    console.log('These eval cases are INVALID -- they test for games we don\'t have.\n');
    for (const g of notFound.sort()) {
      // Count how many eval cases reference this game
      const caseCount = allCases.filter(c =>
        c.shouldInclude.includes(g) || c.shouldNotInclude.includes(g)
      ).length;
      console.log(`  "${g}" (referenced in ${caseCount} eval cases)`);
    }
  }

  if (ambiguous.size > 0) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`\nAMBIGUOUS MATCHES (${ambiguous.size}):`);
    console.log('These game names match multiple entries. The eval runner uses substring\n');
    console.log('matching so "Pandemic" matches "Pandemic Legacy: Season 1" too.\n');
    for (const [name, matches] of ambiguous) {
      console.log(`  "${name}" matches:`);
      for (const m of matches.slice(0, 3)) {
        console.log(`    - ${m.name} (${m.id})`);
      }
      if (matches.length > 3) console.log(`    ... and ${matches.length - 3} more`);
    }
  }

  // Count affected eval cases
  const invalidCases = allCases.filter(c =>
    c.shouldInclude.some(g => notFound.includes(g))
  );
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`\nIMPACT ON EVAL SUITE:`);
  console.log(`  Eval cases with missing shouldInclude games: ${invalidCases.length}`);
  console.log(`  These cases will ALWAYS FAIL regardless of engine quality.`);
  console.log(`  This means ${invalidCases.length} of ${allCases.length} cases (${Math.round(invalidCases.length / allCases.length * 100)}%) are testing for impossible results.\n`);

  // Write report to file
  const report = {
    timestamp: new Date().toISOString(),
    totalGames: gameNames.size,
    foundCount: found.size,
    notFoundCount: notFound.length,
    ambiguousCount: ambiguous.size,
    notFoundGames: notFound.sort(),
    ambiguousGames: Object.fromEntries(ambiguous),
    invalidEvalCaseCount: invalidCases.length,
    invalidEvalCaseNames: invalidCases.map(c => c.name),
  };

  fs.writeFileSync('scripts/eval-validation-report.json', JSON.stringify(report, null, 2));
  console.log(`Full report saved to scripts/eval-validation-report.json`);
}

main().catch(console.error);
