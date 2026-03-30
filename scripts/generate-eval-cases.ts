/**
 * Generate a massive evaluation dataset for the recommendation engine.
 *
 * Uses GPT-4o to generate diverse, realistic test cases covering:
 * - Normal queries, weird queries, typos, ESL formatting
 * - Every game mechanic, theme, player count, time constraint
 * - Edge cases, vague queries, specific references
 *
 * Outputs to scripts/eval-cases.json
 *
 * Usage: source .env.local && npx tsx scripts/generate-eval-cases.ts
 */

import OpenAI from 'openai';
import * as fs from 'fs';

const OUTPUT_FILE = 'scripts/eval-cases.json';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });
  const allCases: any[] = [];

  const batches = [
    {
      category: 'Mechanic-specific queries',
      prompt: `Generate 30 realistic board game recommendation queries focused on specific mechanics.
Include: deck building, worker placement, area control, tile placement, engine building, drafting,
push your luck, trick taking, set collection, roll and write, hidden role, social deduction,
cooperative, dice rolling, hand management, route building, auction, bag building, legacy, campaign.
Each query should be phrased differently (casual, specific, vague, with constraints like time/players).
Include 5 queries with typos or informal language.`,
    },
    {
      category: 'Theme-specific queries',
      prompt: `Generate 30 realistic board game recommendation queries focused on themes.
Include: fantasy, sci-fi, horror, zombie, pirate, space, medieval, western, detective, nature,
animals, food/cooking, trains, sports, war, ancient civilizations, mythology, steampunk, cyberpunk,
post-apocalyptic, superhero, lovecraft/cthulhu, viking, dragon, spy/espionage.
Mix in time constraints, player counts, and complexity preferences.
Include 5 queries from non-native English speakers with unusual grammar.`,
    },
    {
      category: 'Player count queries',
      prompt: `Generate 20 realistic board game recommendation queries focused on player counts.
Cover: solo, 2-player, 3-player, 4-player, 5-6 player, 7+ player, large groups, couples,
date night, family with kids, game night with friends.
Mix casual and specific phrasing. Include 3 with typos.`,
    },
    {
      category: 'Time and complexity queries',
      prompt: `Generate 20 realistic queries with time or complexity constraints.
Cover: under 15 min, under 30 min, about an hour, 2+ hours, quick filler, all day,
light/easy, medium weight, heavy/complex, gateway games, games for non-gamers,
brain-burning strategy, simple rules deep gameplay.
Include 3 queries with informal time descriptions ("quickie", "marathon", "something fast").`,
    },
    {
      category: 'Mood and occasion queries',
      prompt: `Generate 20 realistic queries about moods or occasions.
Cover: date night, rainy day, camping, road trip, thanksgiving, halloween,
game night, work team building, kids birthday, bachelor party, lazy sunday,
competitive, relaxing, stressful (want to destress), celebratory, educational.
Include varied phrasing and 3 with emoji or internet slang.`,
    },
    {
      category: 'Comparison and reference queries',
      prompt: `Generate 20 realistic queries that reference specific games.
Cover: "something like Catan", "better than Monopoly", "if I liked Wingspan",
"Catan but more complex", "like Ticket to Ride but shorter", "Gloomhaven lite",
"the board game version of Stardew Valley", "like Risk but actually good",
"Pandemic but competitive", "Azul but for 6 players".
Include references to video games ("board game like Zelda", "tabletop Minecraft").`,
    },
    {
      category: 'Weird and edge case queries',
      prompt: `Generate 25 unusual, creative, or challenging queries.
Include: extremely vague ("something fun"), overly specific ("game with blue meeples about farming in 17th century France for exactly 3 players"),
emoji-heavy, sarcastic, questions ("what's the best game ever?"), negative ("I hate everything popular"),
non-English words mixed in, extremely long run-on sentences, single-word queries ("dragons"),
queries that aren't about games at all ("I want pizza"), pop culture references,
queries about games that don't exist, requests for very niche combinations.`,
    },
    {
      category: 'Negative preference queries',
      prompt: `Generate 15 queries with explicit negative preferences.
Cover: "no dice", "not cooperative", "anything but Catan", "no luck",
"no player elimination", "nothing longer than 30 min", "not a card game",
"no fantasy theme", "something without too many rules",
"I don't want to read a rulebook for an hour".`,
    },
    {
      category: 'ESL and typo queries',
      prompt: `Generate 20 queries that simulate non-native English speakers or people typing quickly.
Include: misspellings ("stratagy", "cooperativ", "deck bilder"), broken grammar,
mixed languages (Spanglish, Franglais), autocorrect errors, missing spaces,
abbreviated text-speak ("2p strat game 30min"), excessive punctuation,
ALL CAPS, no punctuation at all, stream of consciousness.`,
    },
  ];

  for (const batch of batches) {
    console.log(`Generating: ${batch.category}...`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.9,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `You are generating test cases for a board game recommendation engine evaluation suite.

${batch.prompt}

For each query, provide:
1. The raw query text (exactly as a user would type it)
2. A list of well-known games that SHOULD appear in the top 10 results (use real, popular board game names)
3. A list of games that should NOT appear (games that clearly don't match)

Use only well-known games with 1000+ BGG ratings for shouldInclude. These should be games any board gamer would recognize.

Return JSON: {
  "cases": [
    {
      "name": "short description",
      "query": "the user's raw query text",
      "gameTypes": ["board"],
      "shouldInclude": ["Game Name 1", "Game Name 2"],
      "shouldNotInclude": ["Irrelevant Game 1"]
    }
  ]
}

Rules for shouldInclude:
- Only include games you are VERY confident should appear for this query
- Use exact BGG game names (e.g., "Dominion" not "dominion", "7 Wonders Duel" not "7 wonders")
- Keep shouldInclude to 1-3 games max (fewer is better, only sure things)
- If unsure, leave shouldInclude empty

Rules for shouldNotInclude:
- Include 1-2 games that would clearly be wrong for this query
- Focus on popular games that might show up due to popularity bias (UNO, Chess, Catan for niche queries)`,
      }],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const cases = (parsed.cases ?? []).map((c: any) => ({
        name: `[${batch.category}] ${c.name}`,
        query: c.query,
        gameTypes: c.gameTypes ?? ['board'],
        shouldInclude: c.shouldInclude ?? [],
        shouldNotInclude: c.shouldNotInclude ?? [],
        topN: 10,
      }));
      allCases.push(...cases);
      console.log(`  Generated ${cases.length} cases`);
    } catch {
      console.error(`  Failed to parse response for ${batch.category}`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allCases, null, 2));
  console.log(`\nWrote ${allCases.length} eval cases to ${OUTPUT_FILE}`);
}

main().catch(console.error);
