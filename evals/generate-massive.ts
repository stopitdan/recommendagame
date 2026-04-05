/**
 * Massive Eval Case Generator
 *
 * Uses GPT-4o-mini to generate 10,000+ diverse, realistic eval cases
 * in batches. Each batch targets a specific category and variation type.
 *
 * The generator produces cases that cover:
 * - Every board game mechanic (50+ mechanics x 10 phrasings each = 500+)
 * - Every theme/setting (40+ themes x 10 phrasings = 400+)
 * - Player count permutations (1-12 x various phrasings = 100+)
 * - Time constraints (5min-8hr x hard/soft x phrasings = 200+)
 * - Complexity levels (beginner to expert x phrasings = 100+)
 * - Designer queries (50+ designers x phrasings = 200+)
 * - Similar-to queries (100+ reference games x phrasings = 500+)
 * - Multi-constraint combos (mechanic+theme+players+time = 2000+)
 * - Natural language variations (typos, ESL, slang, emoji = 1000+)
 * - Edge cases and adversarial inputs (500+)
 * - Video game queries (500+)
 * - Mood/occasion queries (500+)
 * - Negative preferences (300+)
 * - Real-world scenarios (date night, family, party, camping = 500+)
 *
 * Total target: 10,000+ cases
 *
 * Usage:
 *   source .env.local && npx tsx evals/generate-massive.ts
 *   BATCH_SIZE=100 npx tsx evals/generate-massive.ts  # Custom batch size
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';
import type { EvalCase, EvalCategory } from './types';

dotenv.config({ path: '.env.local' });

const CASES_FILE = path.join(process.cwd(), 'evals', 'cases.json');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '30', 10);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, timeout: 120000 });

// ─── Batch Definitions ──────────────────────────────────────

interface BatchDef {
  category: EvalCategory;
  description: string;
  count: number;
  prompt: string;
}

const BATCHES: BatchDef[] = [
  // ──── MECHANIC VARIATIONS (2000 cases) ────
  {
    category: 'mechanic-focused',
    description: 'Deck building variations',
    count: 100,
    prompt: `Generate 100 diverse queries that a real person might type when looking for DECK BUILDING board games. Include:
- Direct requests ("deck building game", "deckbuilder")
- Descriptive ("game where you build your deck of cards over time")
- Casual/slang ("i wanna build a deck", "any good deckbuilders?")
- With constraints ("2 player deck builder", "quick deck builder under 30 min")
- With typos ("dekc biulding", "deck bilder")
- Comparative ("like Dominion but...", "better than Star Realms")
- Negative ("deck builder but not too complex")
For each, include shouldInclude (1-2 games max, only if VERY confident) and shouldNotInclude (games that would be clearly wrong). Use exact BGG names. Keep shouldInclude to only the most obvious games like Dominion, Star Realms, Clank. Do NOT include obscure games.`,
  },
  {
    category: 'mechanic-focused',
    description: 'Worker placement variations',
    count: 100,
    prompt: `Generate 100 diverse queries for WORKER PLACEMENT board games. Include direct, descriptive, casual, constrained, typo, comparative, and negative variants. For shouldInclude use only obvious games like Agricola, Viticulture, Lords of Waterdeep, Caverna. For shouldNotInclude use clearly wrong games like UNO, Chess, Poker.`,
  },
  {
    category: 'mechanic-focused',
    description: 'Area control variations',
    count: 80,
    prompt: `Generate 80 diverse queries for AREA CONTROL / TERRITORY board games. Include direct, descriptive, casual, constrained variants. shouldInclude: Root, Risk, Kemet, Blood Rage (only if confident). shouldNotInclude: clearly irrelevant games.`,
  },
  {
    category: 'mechanic-focused',
    description: 'Engine building variations',
    count: 80,
    prompt: `Generate 80 diverse queries for ENGINE BUILDING board games. Include direct, descriptive, casual, constrained variants. shouldInclude: Terraforming Mars, Wingspan (only if confident). shouldNotInclude: clearly irrelevant games.`,
  },
  {
    category: 'mechanic-focused',
    description: 'Social deduction variations',
    count: 80,
    prompt: `Generate 80 diverse queries for SOCIAL DEDUCTION board games (hidden roles, traitor, bluffing). Include direct, descriptive, casual variants. shouldInclude: Secret Hitler, The Resistance, Werewolf (only if confident). shouldNotInclude: cooperative games like Pandemic.`,
  },
  {
    category: 'mechanic-focused',
    description: 'Other mechanics',
    count: 200,
    prompt: `Generate 200 diverse queries covering ALL of these mechanics (roughly 10 queries each): tile placement, trick taking, push your luck, roll and write, card drafting, auction/bidding, set collection, route building, bag building, cooperative play, legacy/campaign, pattern building, tableau building, resource management, hand management, pick up and deliver, hidden movement, programmed movement, real-time. For each, vary phrasing between direct, descriptive, casual, and constrained. Use only very famous games for shouldInclude.`,
  },

  // ──── THEME VARIATIONS (1500 cases) ────
  {
    category: 'theme-focused',
    description: 'Fantasy/Sci-Fi/Horror themes',
    count: 150,
    prompt: `Generate 150 diverse queries for board games with these themes (roughly 10 each): fantasy, sci-fi, space, horror, zombie, vampire, werewolf, steampunk, cyberpunk, post-apocalyptic, Lovecraftian, dragons, magic/wizards, mythology, fairy tale. Vary phrasings. shouldNotInclude games that clearly don't match the theme (e.g., UNO for fantasy, Agricola for sci-fi).`,
  },
  {
    category: 'theme-focused',
    description: 'Historical/Nature/Modern themes',
    count: 150,
    prompt: `Generate 150 diverse queries for: medieval, ancient Egypt, ancient Rome, Viking, samurai/Japan, WWII, Cold War, pirate, western/cowboy, train, nature/animals, ocean/underwater, dinosaur, jungle, arctic, farming, wine, cooking/food. Vary phrasings.`,
  },
  {
    category: 'theme-focused',
    description: 'Pop culture and niche themes',
    count: 100,
    prompt: `Generate 100 queries for: superhero, anime/manga, detective/mystery, spy/espionage, racing, sports, music, art, city building, civilization building, trading/merchants, politics, mafia/crime, robots, cats, dogs, time travel, space opera. Vary phrasings.`,
  },

  // ──── PLAYER COUNT (500 cases) ────
  {
    category: 'player-count',
    description: 'All player counts',
    count: 200,
    prompt: `Generate 200 diverse queries specifying player counts from 1 to 12+. Include:
- Exact counts ("game for exactly 3 players")
- Ranges ("2-4 players", "3-6 people")
- Context-based ("date night" = 2p, "family of 5", "large group", "solo")
- Edge cases ("is there a good 1 player game?", "we have 10 people")
- With other constraints ("2 player strategy under 30 min")
For each, set playerCount field. shouldNotInclude games that violate the count (e.g., Codenames for solo, Patchwork for 6+).`,
  },

  // ──── TIME CONSTRAINTS (400 cases) ────
  {
    category: 'time-constraint',
    description: 'All time constraints',
    count: 200,
    prompt: `Generate 200 queries with time constraints covering:
- Very short (5-15 min filler games)
- Short (15-30 min)
- Medium (30-60 min)
- Long (1-2 hours)
- Epic (2+ hours, all day)
- Hard limits ("under 30 minutes", "no more than an hour")
- Soft limits ("about 45 minutes", "around 2 hours")
- Context-based ("lunch break", "coffee break", "game night", "all-day marathon")
Set constraints.maxMinutes and constraints.timeStrictness. shouldNotInclude: Twilight Imperium for short queries, Love Letter for epic queries.`,
  },

  // ──── COMPLEXITY (300 cases) ────
  {
    category: 'complexity',
    description: 'All complexity levels',
    count: 150,
    prompt: `Generate 150 queries covering complexity levels:
- Ultra-light (non-gamers, kids, never played before)
- Light (gateway, family, casual)
- Medium (step up from Catan, hobby gamer)
- Heavy (brain-burning, experienced only)
- Ultra-heavy (18xx, wargamer, 4+ hour brain melter)
Set constraints.complexity. shouldNotInclude: heavy games for kids queries, simple games for heavy queries.`,
  },

  // ──── DESIGNER QUERIES (300 cases) ────
  {
    category: 'designer-search',
    description: 'Designer searches',
    count: 150,
    prompt: `Generate 150 queries mentioning specific board game designers. Cover at least these designers (multiple queries each, varying phrasing):
Uwe Rosenberg, Stefan Feld, Reiner Knizia, Vlaada Chvatil, Vital Lacerda, Alexander Pfister, Cole Wehrle, Jamey Stegmaier, Matt Leacock, Eric Lang, Bruno Cathala, Phil Walker-Harding, Wolfgang Kramer, Michael Kiesling, Corey Konieczka, Rob Daviau, Isaac Childres, Friedemann Friese, Martin Wallace, Antoine Bauza.
Include: "games by X", "X's best game", "anything by X", "designer X worker placement". Set constraints.designer. shouldInclude their most famous games (1-2 max).`,
  },

  // ──── SIMILAR-TO QUERIES (500 cases) ────
  {
    category: 'similar-to',
    description: 'Similar-to reference queries',
    count: 250,
    prompt: `Generate 250 "similar to" queries referencing specific games. Cover:
- "like Catan but..." variations (less luck, more strategy, shorter, etc.)
- "like Pandemic but..." (competitive, shorter, simpler, etc.)
- "like Gloomhaven but..." (shorter, less commitment, solo, etc.)
- "like Ticket to Ride but..." (more complex, different theme, etc.)
- Board game versions of video games ("board game like Minecraft/Zelda/Stardew Valley")
- Games similar to other games ("games like Wingspan", "if I like 7 Wonders")
- Cross-medium ("board game that feels like Game of Thrones/Lord of the Rings")
shouldNotInclude the referenced game itself and clearly irrelevant games.`,
  },

  // ──── MULTI-CONSTRAINT (1000 cases) ────
  {
    category: 'multi-constraint',
    description: 'Combined constraints 2-way',
    count: 200,
    prompt: `Generate 200 queries with exactly 2 constraints combined:
- mechanic + player count
- theme + time
- complexity + player count
- mood + time
- mechanic + complexity
Set appropriate playerCount, constraints, gameTypes. shouldNotInclude games that violate constraints.`,
  },
  {
    category: 'multi-constraint',
    description: 'Combined constraints 3-way',
    count: 200,
    prompt: `Generate 200 queries with exactly 3 constraints combined:
- mechanic + player count + time
- theme + complexity + player count
- mood + mechanic + time
Set appropriate fields. shouldNotInclude games violating constraints.`,
  },
  {
    category: 'multi-constraint',
    description: 'Combined constraints 4+ way',
    count: 100,
    prompt: `Generate 100 queries with 4+ constraints. E.g., "cooperative deck builder for 2 players under an hour, medium weight". Set all appropriate fields.`,
  },

  // ──── NEGATIVE PREFERENCES (300 cases) ────
  {
    category: 'negative-preference',
    description: 'Exclusion queries',
    count: 150,
    prompt: `Generate 150 queries with negative/exclusion preferences:
- "no dice", "without luck", "no player elimination"
- "not too complex", "nothing too long"
- "no war themes", "no fantasy"
- "anything but Catan", "no cooperative games"
- "no hidden traitor mechanics"
shouldNotInclude games that match the excluded criteria.`,
  },

  // ──── MOOD/OCCASION (500 cases) ────
  {
    category: 'mood-vibe',
    description: 'Mood and occasion queries',
    count: 250,
    prompt: `Generate 250 queries based on moods and occasions:
- Moods: chill, competitive, cooperative, brain-teaser, social, story-driven, funny, intense, relaxing
- Occasions: date night, family dinner, Thanksgiving, office party, camping trip, road trip, airplane, rainy day, birthday party, game night, bachelor party, kids sleepover, retirement home, classroom, pub
shouldNotInclude clearly inappropriate games (Twilight Imperium for casual/quick, Gloomhaven for non-gamers).`,
  },

  // ──── EDGE CASES (500 cases) ────
  {
    category: 'edge-case',
    description: 'Adversarial and weird inputs',
    count: 250,
    prompt: `Generate 250 edge case/adversarial queries:
- Single word ("fun", "strategy", "cards")
- Emoji only
- Very long rambling stories
- Non-game queries ("best pizza", "weather forecast")
- Sarcastic/hostile ("board games suck", "convince me games aren't boring")
- Contradictory ("quick game that takes all day")
- Non-English or mixed language
- Text speak and abbreviations
- All caps, no caps
- Just a game name
- Just a designer name
- Questions ("what should I play?", "is Catan good?")
- Budget references ("cheap game under $20")
- Award references ("Spiel des Jahres winners")
- Meta requests ("most popular game on BGG")
These should have empty shouldInclude/shouldNotInclude since we just want no crashes.`,
  },

  // ──── VIDEO GAMES (500 cases) ────
  {
    category: 'video-game',
    description: 'Video game queries',
    count: 250,
    prompt: `Generate 250 queries for VIDEO GAME recommendations covering genres:
- RPG, JRPG, action RPG, roguelike, roguelite, metroidvania
- Platformer, puzzle, adventure, survival, horror, stealth
- Strategy, 4X, city builder, simulation, farming
- FPS, fighting, racing, sports, rhythm
- Visual novel, walking simulator, cozy
- Battle royale, auto battler, MOBA
- Indie, pixel art, soulslike
Set gameTypes: ["video"]. shouldNotInclude board games (Catan, Ticket to Ride, etc.).`,
  },

  // ──── FREE TEXT INTENT (500 cases) ────
  {
    category: 'free-text-intent',
    description: 'Natural language intent',
    count: 250,
    prompt: `Generate 250 natural language queries that test intent understanding:
- Emotional ("im stressed and need to unwind", "feeling competitive tonight")
- Contextual ("my wife hates games what would she enjoy", "for non-gamer in-laws")
- Descriptive ("something where you build stuff", "game about betrayal and lying")
- Comparative ("step up from Ticket to Ride", "gateway to heavier games")
- Gift-oriented ("birthday gift for Catan fan", "Christmas present for a 12 year old")
- Group-specific ("team building at work", "game for drunk friends")
shouldNotInclude clearly inappropriate games based on intent.`,
  },

  // ──── REAL USER FEEDBACK (200 cases) ────
  {
    category: 'real-user-feedback',
    description: 'Real-world style queries',
    count: 100,
    prompt: `Generate 100 queries that sound like real user submissions from a game recommendation website. These should be messy, imprecise, and human:
- Run-on sentences with multiple requests
- Vague descriptions ("something fun")
- Specific but poorly articulated ("that game where you build train routes")
- With context ("for my D&D group", "we just finished Pandemic and want more")
- Complaints ("everything I play is too complicated")
- Requests with backstory ("my partner and I play every Tuesday night...")
Include realistic shouldInclude/shouldNotInclude based on intent.`,
  },

  // ──── ADDITIONAL BATCHES TO HIT 5000 TARGET ────

  // More mechanic combos (300 cases)
  {
    category: 'mechanic-focused',
    description: 'Mechanic combo queries',
    count: 150,
    prompt: `Generate 150 queries that combine TWO mechanics: "deck building + area control", "worker placement + engine building", "trick taking + set collection", "tile placement + pattern building", "push your luck + dice rolling", etc. Cover all interesting mechanic pairings. shouldNotInclude games that match neither mechanic.`,
  },

  // More theme + mechanic combos (300 cases)
  {
    category: 'multi-constraint',
    description: 'Theme plus mechanic',
    count: 150,
    prompt: `Generate 150 queries combining a THEME with a MECHANIC: "fantasy deck builder", "sci-fi worker placement", "pirate area control", "zombie cooperative", "medieval tile placement", "space engine building", "horror social deduction". Include varied phrasings. shouldNotInclude clearly wrong games.`,
  },

  // Regression-style probes (200 cases)
  {
    category: 'regression',
    description: 'Known failure mode probes',
    count: 100,
    prompt: `Generate 100 queries specifically designed to test for common recommendation failures:
- Queries where UNO/Chess/Poker should NEVER appear ("anime themed", "deck building", "worker placement")
- Queries where board games should NOT appear for video game requests
- Queries where multiplayer-only games should NOT appear for solo requests
- Queries where 3+ hour games should NOT appear for "quick" or "under 30 min" requests
- Queries where kids games should NOT appear for "heavy strategy" requests
For EACH case, include 2-3 specific games in shouldNotInclude with clear reasons. These are TRAP cases -- they test if the engine returns obviously wrong results.`,
  },

  // Party game scenarios (200 cases)
  {
    category: 'party-game',
    description: 'Party and social scenarios',
    count: 100,
    prompt: `Generate 100 party/social game queries covering:
- Various group sizes (4-20 people)
- Various settings (house party, wedding, office, bar, outdoor)
- Various audiences (adults, mixed ages, kids, non-gamers, gamers)
- Various constraints (quick, no reading, easy to explain, loud environment)
shouldNotInclude heavy strategy games (Twilight Imperium, Brass, Gloomhaven) and solo games (Mage Knight).`,
  },

  // More video game specifics (300 cases)
  {
    category: 'video-game',
    description: 'Specific video game queries',
    count: 150,
    prompt: `Generate 150 very specific video game queries:
- Referencing specific games ("games like Hollow Knight", "better than Elden Ring")
- Platform-specific ("good Switch games", "PC strategy game", "PS5 exclusive")
- Era-specific ("retro 16-bit RPG", "modern indie", "90s adventure game")
- Art style ("pixel art", "hand-drawn", "cel-shaded", "photorealistic")
- Feature-specific ("procedural generation", "character customization", "open world", "multiplayer co-op")
Set gameTypes: ["video"]. shouldNotInclude board games.`,
  },

  // Natural language diversity (300 cases)
  {
    category: 'free-text-intent',
    description: 'Diverse natural language',
    count: 150,
    prompt: `Generate 150 queries with maximum linguistic diversity:
- 20 queries with heavy typos and misspellings
- 20 queries in text speak (u, r, 2, 4, thx, lol, etc.)
- 20 queries in broken English (ESL speakers from various backgrounds)
- 20 queries that are just describing gameplay without naming mechanics ("game where you put down tiles to make patterns")
- 20 queries with emotional context ("need something to cheer me up", "want to feel like an explorer")
- 20 queries referencing non-game media ("game that feels like Lord of the Rings", "board game version of Among Us")
- 30 queries with mixed constraints expressed naturally ("something my grandma and my 8 year old can both enjoy that doesnt take forever")
shouldNotInclude clearly inappropriate games.`,
  },

  // Catch-all to guarantee 5000 (200 cases)
  {
    category: 'free-text-intent',
    description: 'Final diverse fill',
    count: 200,
    prompt: `Generate 200 completely unique, diverse game recommendation queries. Each should feel like a different real person typing. Cover every imaginable angle:
- Someone who's never played a board game
- A hardcore gamer looking for something new
- A parent shopping for their kid
- A couple looking for date night entertainment
- College students at a party
- Someone bored at work
- A teacher for their classroom
- Someone recovering from a breakup
- Someone preparing for a camping trip
- A grandparent wanting to connect with grandkids
Make every single query different in tone, intent, and specificity. shouldNotInclude obviously wrong games where applicable.`,
  },
];

// ─── LLM Case Generation ───────────────────────────────────

const SYSTEM_PROMPT = `You are generating test cases for a game recommendation engine evaluation suite. For each test case, output a JSON object.

CRITICAL RULES:
1. Use EXACT BoardGameGeek game names for shouldInclude (e.g., "7 Wonders Duel" not "7 wonders duel")
2. Only include games in shouldInclude if you are VERY CONFIDENT they should appear for this query
3. Keep shouldInclude to 0-2 games maximum. Most cases should have 0-1.
4. shouldNotInclude should contain 0-2 games that would be CLEARLY WRONG for this query
5. Queries should feel like real human input -- messy, informal, with personality
6. Include natural typos, abbreviations, and casual phrasing in ~20% of queries
7. Every query must be UNIQUE -- no duplicates or trivial rephrasing

Output a JSON array of objects with these fields:
- "name": short descriptive name (e.g., "Deck builder casual phrasing")
- "query": the actual query text a user would type
- "gameTypes": array of "board" or "video" (empty if unspecified)
- "playerCount": {"min": N, "max": N} or null if unspecified
- "constraints": object with maxMinutes, timeStrictness ("hard"/"soft"), complexity ({"min":N,"max":N}), designer (string), or null
- "shouldInclude": array of {"name": "Game Name", "relevance": 2 or 3}
- "shouldNotInclude": array of {"name": "Game Name", "reason": "why wrong"}
- "tags": array of strings like "typo", "esl", "casual", "constrained"`;

async function generateBatch(batch: BatchDef, startId: number): Promise<EvalCase[]> {
  const cases: EvalCase[] = [];

  // Split into sub-batches of BATCH_SIZE
  const numSubBatches = Math.ceil(batch.count / BATCH_SIZE);

  for (let sub = 0; sub < numSubBatches; sub++) {
    const subCount = Math.min(BATCH_SIZE, batch.count - sub * BATCH_SIZE);
    const subOffset = sub * BATCH_SIZE;

    process.stdout.write(`  ${batch.description} [${subOffset + 1}-${subOffset + subCount}/${batch.count}]... `);

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.9, // High creativity for diverse queries
        max_tokens: 16000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${batch.prompt}\n\nGenerate exactly ${subCount} cases. Return JSON: {"cases": [...]}`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        console.log('EMPTY RESPONSE');
        continue;
      }

      const parsed = JSON.parse(raw);
      const rawCases = parsed.cases ?? parsed;

      if (!Array.isArray(rawCases)) {
        console.log('NOT AN ARRAY');
        continue;
      }

      for (const rc of rawCases) {
        const id = startId + cases.length;
        cases.push({
          id: `${batch.category}-${String(id).padStart(5, '0')}`,
          name: rc.name ?? `${batch.description} #${cases.length + 1}`,
          category: batch.category,
          query: rc.query ?? '',
          gameTypes: rc.gameTypes ?? [],
          playerCount: rc.playerCount ?? undefined,
          constraints: rc.constraints ?? undefined,
          idealGames: (rc.shouldInclude ?? []).map((g: any) => ({
            name: typeof g === 'string' ? g : g.name,
            relevance: (typeof g === 'object' ? g.relevance : 2) as 0 | 1 | 2 | 3,
          })),
          antiGames: (rc.shouldNotInclude ?? []).map((g: any) => ({
            name: typeof g === 'string' ? g : g.name,
            reason: typeof g === 'object' ? g.reason : 'Should not appear',
          })),
          tags: rc.tags ?? [],
        });
      }

      console.log(`${rawCases.length} cases`);
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  return cases;
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  // Load existing hand-curated cases
  let existingCases: EvalCase[] = [];
  if (fs.existsSync(CASES_FILE)) {
    existingCases = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));
    console.log(`Loaded ${existingCases.length} existing cases`);
  }

  const totalTarget = BATCHES.reduce((sum, b) => sum + b.count, 0);
  console.log(`\nGenerating ${totalTarget} new cases across ${BATCHES.length} batches\n`);
  console.log('='.repeat(60));

  const allNewCases: EvalCase[] = [];
  let idOffset = existingCases.length;

  for (let i = 0; i < BATCHES.length; i++) {
    const batch = BATCHES[i];
    console.log(`\nBatch ${i + 1}/${BATCHES.length}: ${batch.description} (${batch.count} cases)`);
    console.log('-'.repeat(60));

    const batchCases = await generateBatch(batch, idOffset);
    allNewCases.push(...batchCases);
    idOffset += batchCases.length;

    console.log(`  Total so far: ${allNewCases.length}`);
  }

  // Combine with existing cases
  const combined = [...existingCases, ...allNewCases];

  // Deduplicate by query text (case-insensitive)
  const seen = new Set<string>();
  const deduped = combined.filter(c => {
    const key = c.query.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Generated: ${allNewCases.length} new cases`);
  console.log(`Combined: ${combined.length} total`);
  console.log(`After dedup: ${deduped.length} unique cases`);

  // Category summary
  const catCount = new Map<string, number>();
  for (const c of deduped) {
    catCount.set(c.category, (catCount.get(c.category) ?? 0) + 1);
  }
  console.log('\nCategory breakdown:');
  for (const [cat, count] of [...catCount.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(24)} ${count}`);
  }

  // Write
  fs.writeFileSync(CASES_FILE, JSON.stringify(deduped, null, 2));
  console.log(`\nWritten ${deduped.length} cases to ${CASES_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
