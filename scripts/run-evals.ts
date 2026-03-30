/**
 * Recommendation Engine Evaluation Suite
 *
 * Runs predefined queries against the recommend API and checks if
 * the results meet quality expectations. Outputs a pass/fail report.
 *
 * Usage: source .env.local && npx tsx scripts/run-evals.ts
 *
 * Each eval case defines:
 * - query: the free text input
 * - gameTypes: optional type filter
 * - shouldInclude: game names that MUST appear in top N results
 * - shouldNotInclude: game names that must NOT appear in top N
 * - topN: how many results to check (default 10)
 */

const API_URL = process.env.EVAL_API_URL ?? 'http://localhost:1337';

interface EvalCase {
  name: string;
  query: string;
  gameTypes?: string[];
  playerCount?: { min: number; max: number };
  shouldInclude: string[];
  shouldNotInclude: string[];
  topN?: number;
}

const EVAL_CASES: EvalCase[] = [
  // Mechanic-specific queries
  {
    name: 'Deck builder - fast',
    query: 'fast deck builder under 30 minutes',
    gameTypes: ['board'],
    shouldInclude: ['Dominion', 'Star Realms'],
    shouldNotInclude: ['Heraldica', 'Carcassonne', 'Uncharted'],
  },
  {
    name: 'Worker placement - medium weight',
    query: 'medium weight worker placement game',
    gameTypes: ['board'],
    shouldInclude: ['Viticulture', 'Agricola'],
    shouldNotInclude: ['UNO', 'Codenames'],
  },
  {
    name: 'Area control - competitive',
    query: 'competitive area control game for 4 players',
    gameTypes: ['board'],
    shouldInclude: ['Root'],
    shouldNotInclude: ['Pandemic', 'Hanabi'],
  },

  // Theme-specific queries
  {
    name: 'Cooperative dungeon crawler',
    query: 'cooperative dungeon crawler with dice combat, fantasy or horror, 2 players',
    gameTypes: ['board'],
    shouldInclude: ['Zombicide', 'Gloomhaven'],
    shouldNotInclude: ['UNO', 'Codenames', 'Ticket to Ride'],
  },
  {
    name: 'TV show themed game',
    query: 'game about a tv show and cowboys',
    gameTypes: ['board'],
    shouldInclude: ['Western Legends'],
    shouldNotInclude: ['UNO', 'Chess', 'Poker'],
  },
  {
    name: 'Space themed game',
    query: 'space exploration game',
    gameTypes: ['board'],
    shouldInclude: [],
    shouldNotInclude: ['UNO', 'Carcassonne', 'Ticket to Ride'],
  },
  {
    name: 'Zombie game',
    query: 'zombie survival board game',
    gameTypes: ['board'],
    shouldInclude: ['Zombicide'],
    shouldNotInclude: ['Chess', 'Azul', 'Wingspan'],
  },
  {
    name: 'Pirate game',
    query: 'pirate themed board game',
    gameTypes: ['board'],
    shouldInclude: [],
    shouldNotInclude: ['UNO', 'Chess', 'Agricola'],
  },

  // Player count queries
  {
    name: '2 player strategy',
    query: '2 player strategy game under an hour',
    gameTypes: ['board'],
    playerCount: { min: 2, max: 2 },
    shouldInclude: ['7 Wonders Duel', 'Patchwork'],
    shouldNotInclude: ['Twilight Imperium'],
  },
  {
    name: 'Solo game',
    query: 'best solo board game',
    gameTypes: ['board'],
    playerCount: { min: 1, max: 1 },
    shouldInclude: [],
    shouldNotInclude: ['Codenames', 'Secret Hitler', 'Dixit'],
  },
  {
    name: 'Party game for 6+',
    query: 'party game for 6 or more people',
    gameTypes: ['board'],
    playerCount: { min: 6, max: 10 },
    shouldInclude: ['Codenames'],
    shouldNotInclude: ['Patchwork', '7 Wonders Duel'],
  },

  // Complexity queries
  {
    name: 'Light family game',
    query: 'light family game anyone can play',
    gameTypes: ['board'],
    shouldInclude: ['Ticket to Ride'],
    shouldNotInclude: ['Twilight Imperium', 'Brass: Birmingham'],
  },
  {
    name: 'Heavy strategy',
    query: 'heavy complex strategy game for experienced players',
    gameTypes: ['board'],
    shouldInclude: [],
    shouldNotInclude: ['UNO', 'Exploding Kittens', 'Love Letter'],
  },

  // Time queries
  {
    name: 'Quick filler game',
    query: 'quick filler game under 15 minutes',
    gameTypes: ['board'],
    shouldInclude: ['Love Letter'],
    shouldNotInclude: ['Gloomhaven', 'Twilight Imperium'],
  },

  // Mood queries
  {
    name: 'Chill relaxing game',
    query: 'chill relaxing game for 2',
    gameTypes: ['board'],
    shouldInclude: [],
    shouldNotInclude: ['Secret Hitler', 'Blood Rage'],
  },
  {
    name: 'Competitive cutthroat',
    query: 'cutthroat competitive game where you can screw people over',
    gameTypes: ['board'],
    shouldInclude: [],
    shouldNotInclude: ['Pandemic', 'Forbidden Island', 'Hanabi'],
  },

  // Negative preferences
  {
    name: 'Strategy but not war',
    query: 'strategy game but no war or fighting themes',
    gameTypes: ['board'],
    shouldInclude: [],
    shouldNotInclude: ['Risk', 'Axis & Allies'],
  },

  // Edge cases
  {
    name: 'Vague query - bored',
    query: "I'm bored what should I play",
    shouldInclude: [],
    shouldNotInclude: [],
    topN: 5,
  },
  {
    name: 'Specific game reference',
    query: 'something like Catan but better',
    gameTypes: ['board'],
    shouldInclude: [],
    shouldNotInclude: ['UNO', 'Chess'],
  },
];

// ─── Runner ─────────────────────────────────────────────────

interface EvalResult {
  name: string;
  passed: boolean;
  failures: string[];
  topResults: string[];
  duration: number;
}

async function runEval(evalCase: EvalCase): Promise<EvalResult> {
  const start = Date.now();
  const topN = evalCase.topN ?? 10;
  const failures: string[] = [];

  try {
    const res = await fetch(`${API_URL}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _nocache: true,
        gameTypes: evalCase.gameTypes ?? [],
        playerCount: evalCase.playerCount ?? { min: 1, max: 10 },
        timePresets: [],
        complexity: { min: 1, max: 5 },
        genres: [],
        moods: [],
        freeText: evalCase.query,
      }),
    });

    if (!res.ok) {
      failures.push(`API returned ${res.status}`);
      return { name: evalCase.name, passed: false, failures, topResults: [], duration: Date.now() - start };
    }

    const data = await res.json();
    const results: string[] = (data.results ?? []).slice(0, topN).map((g: any) => g.name);

    // Check shouldInclude
    for (const expected of evalCase.shouldInclude) {
      const found = results.some((r: string) =>
        r.toLowerCase().includes(expected.toLowerCase())
      );
      if (!found) {
        failures.push(`MISSING: "${expected}" not in top ${topN} results`);
      }
    }

    // Check shouldNotInclude
    for (const excluded of evalCase.shouldNotInclude) {
      const found = results.some((r: string) =>
        r.toLowerCase().includes(excluded.toLowerCase())
      );
      if (found) {
        failures.push(`UNWANTED: "${excluded}" found in top ${topN} results`);
      }
    }

    return {
      name: evalCase.name,
      passed: failures.length === 0,
      failures,
      topResults: results.slice(0, 5),
      duration: Date.now() - start,
    };
  } catch (err) {
    failures.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return { name: evalCase.name, passed: false, failures, topResults: [], duration: Date.now() - start };
  }
}

async function main() {
  console.log(`\n🎲 boredgame.lol Recommendation Evals`);
  console.log(`   API: ${API_URL}`);
  console.log(`   Cases: ${EVAL_CASES.length}\n`);
  console.log('─'.repeat(70));

  const results: EvalResult[] = [];

  for (const evalCase of EVAL_CASES) {
    process.stdout.write(`  ${evalCase.name}... `);
    const result = await runEval(evalCase);
    results.push(result);

    if (result.passed) {
      console.log(`PASS (${result.duration}ms)`);
    } else {
      console.log(`FAIL (${result.duration}ms)`);
      for (const f of result.failures) {
        console.log(`    ${f}`);
      }
    }
    console.log(`    Top 5: ${result.topResults.join(' | ')}`);
    console.log('');
  }

  console.log('─'.repeat(70));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n  Results: ${passed} passed, ${failed} failed out of ${results.length} total`);
  console.log(`  Pass rate: ${Math.round((passed / results.length) * 100)}%`);
  console.log(`  Total time: ${(totalDuration / 1000).toFixed(1)}s\n`);

  if (failed > 0) {
    console.log('  Failed cases:');
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    - ${r.name}: ${r.failures.join(', ')}`);
    }
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
