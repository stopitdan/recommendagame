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
    // ── Mechanics (100 queries) ──
    {
      category: 'Mechanics: Deck/Engine/Worker',
      prompt: `Generate 50 realistic board game recommendation queries about deck building, engine building, or worker placement mechanics. Every query must be unique and phrased differently. Mix casual ("I wanna build an engine"), specific ("heavy worker placement for 3"), vague ("something where you collect cards and make combos"), with constraints (time, players, complexity). Include 10 with typos or text-speak.`,
    },
    {
      category: 'Mechanics: Area/Tile/Draft/Other',
      prompt: `Generate 50 realistic queries about area control, tile placement, drafting, set collection, push your luck, trick taking, roll and write, route building, auction, bag building, social deduction, hidden role, cooperative, dice rolling, hand management, legacy, campaign, real-time, dexterity, or programming mechanics. Every query unique. Mix phrasing styles. Include 10 with typos.`,
    },

    // ── Themes (100 queries) ──
    {
      category: 'Themes: Fantasy/Sci-Fi/Horror',
      prompt: `Generate 50 realistic queries about fantasy, sci-fi, horror, zombie, lovecraft/cthulhu, dragon, vampire, werewolf, ghost, dungeon, magic, wizard, demon, angel, mythology, fairy tale themes. Mix with player counts, time limits, complexity. Include 8 with unusual grammar or ESL phrasing.`,
    },
    {
      category: 'Themes: Historical/Nature/Modern',
      prompt: `Generate 50 realistic queries about medieval, viking, roman, egyptian, pirate, western, wild west, cowboy, war, WW2, vietnam, cold war, spy, detective, crime, nature, animals, dinosaur, ocean, space, steampunk, cyberpunk, post-apocalyptic, food, cooking, farming, trains, racing, sports, city building themes. Every query unique. Include 8 ESL/typo variants.`,
    },

    // ── Player Counts (60 queries) ──
    {
      category: 'Player counts: Solo to 4',
      prompt: `Generate 30 realistic queries focused on solo play, 2-player, couples, date night, 3-player, 4-player game night. Mix themes and mechanics in naturally. "me and my wife want...", "just me alone on a friday night", "exactly 3 of us". Include 5 with typos.`,
    },
    {
      category: 'Player counts: 5+ and groups',
      prompt: `Generate 30 realistic queries focused on 5-6 players, 7+ players, large groups, party games, family gatherings, work events, bachelor parties, holiday dinners, classroom games. Include 5 with informal language or slang.`,
    },

    // ── Time and Complexity (60 queries) ──
    {
      category: 'Time constraints',
      prompt: `Generate 30 realistic queries with specific time constraints. Cover: under 10 min, under 15 min, under 30 min, about 45 min, about an hour, 90 minutes, 2 hours, 3+ hours, all day, quick filler between games, lunch break game, airport game. Use varied phrasing: "quickie", "marathon session", "we only got 20 min", "something we can knock out fast". Include 5 typo variants.`,
    },
    {
      category: 'Complexity levels',
      prompt: `Generate 30 realistic queries about complexity. Cover: extremely simple, for toddlers, for kids, for grandma, gateway games, games for people who don't play games, medium weight, heavy euro, brain burner, 18xx complexity, Lacerda-level, simple rules but deep strategy, easy to teach hard to master, no rulebook reading. Include 5 informal phrasing.`,
    },

    // ── Moods and Occasions (80 queries) ──
    {
      category: 'Moods',
      prompt: `Generate 40 realistic queries about moods and feelings. Cover: relaxing, chill, cozy, intense, stressful, competitive, cutthroat, mean, friendly, collaborative, social, quiet, thinky, mindless, funny, hilarious, serious, dramatic, tense, suspenseful, satisfying, addictive, replayable, surprising, creative, educational, nostalgic, retro. Include 5 with emoji.`,
    },
    {
      category: 'Occasions',
      prompt: `Generate 40 realistic queries about specific occasions. Cover: date night, game night with friends, thanksgiving, christmas, halloween, new years eve, birthday party, kids sleepover, camping trip, road trip, flight/airport, waiting room, beach, park, bar/pub, coffee shop, office team building, classroom, retirement home, wedding reception, baby shower, super bowl party, rainy afternoon, snow day, power outage, first date, long distance relationship (online). Include 5 with slang.`,
    },

    // ── Comparisons and References (80 queries) ──
    {
      category: 'Board game comparisons',
      prompt: `Generate 40 realistic queries that reference specific board games. Cover: "like Catan but X", "better than Monopoly", "similar to Pandemic", "Gloomhaven but shorter", "Wingspan for people who like X", "next step after Ticket to Ride", "if I love Azul", "Codenames but cooperative", "7 Wonders but simpler", "Terraforming Mars lite", "Spirit Island for beginners", "Root but less mean", comparisons between 2 games, "upgrade from X". Use real popular game names.`,
    },
    {
      category: 'Video game to board game',
      prompt: `Generate 40 realistic queries referencing video games or pop culture. Cover: "board game like Zelda", "tabletop Minecraft", "Stardew Valley board game", "Dark Souls but a board game", "something like Civilization the video game", "board game version of Among Us", "like Slay the Spire", "Pokemon but tabletop", "Fire Emblem board game", "like XCOM", references to movies (Star Wars, Lord of the Rings, Marvel, Game of Thrones), TV shows (Stranger Things, Breaking Bad, Yellowstone), books (Dune, Harry Potter). Include 5 with typos.`,
    },

    // ── Weird/Edge Cases (80 queries) ──
    {
      category: 'Extremely vague queries',
      prompt: `Generate 20 extremely vague or minimal queries. Single words ("dragons", "fun", "strategy", "cards"), short phrases ("something good", "the best one", "idk surprise me", "whatever", "anything really"), philosophical ("what is the meaning of board games"), meta ("recommend me a recommendation"), emoji-only, just punctuation, blank-adjacent.`,
    },
    {
      category: 'Extremely specific queries',
      prompt: `Generate 20 extremely specific or unusual queries. Overly detailed ("game with blue and yellow wooden meeples set in 17th century France involving wine production for exactly 3 players that takes 90 minutes"), niche combinations ("cooperative pirate deckbuilder with dice for 2"), impossible requests ("board game with no components"), contradictions ("competitive cooperative solo game"), very long run-on sentences.`,
    },
    {
      category: 'Sarcastic and hostile queries',
      prompt: `Generate 20 sarcastic, skeptical, or hostile queries. "all board games are boring change my mind", "my wife hates games, find one she won't", "something for people who think they're too cool for board games", "a game that won't make me fall asleep", "not another boring eurogame", "games for people who actually have friends", "something my gamer friend will shut up about", "the most overrated game".`,
    },
    {
      category: 'Non-game queries and nonsense',
      prompt: `Generate 20 queries that aren't really about games or are nonsensical. "I want pizza", "how do I fix my car", "best restaurant near me", "asdfghjkl", random characters, song lyrics, movie quotes, other languages entirely (Japanese, Spanish, Arabic), math equations, code snippets. The engine should still return SOMETHING reasonable or handle gracefully.`,
    },

    // ── Negative Preferences (40 queries) ──
    {
      category: 'Negative preferences: mechanics',
      prompt: `Generate 20 queries with explicit negative mechanic preferences. "no dice", "no luck", "not cooperative", "anything without worker placement", "no card games", "hate deck building", "nothing with area control", "no hidden traitor", "something without auctions", "no player elimination", "nothing with a board". Include 3 with informal phrasing.`,
    },
    {
      category: 'Negative preferences: themes and constraints',
      prompt: `Generate 20 queries with negative theme or constraint preferences. "no fantasy", "nothing with zombies", "not a war game", "no sci-fi", "anything but Catan", "nothing longer than 20 minutes", "I hate party games", "nothing for kids", "no miniatures games too expensive", "nothing that takes forever to set up", "no games with a million expansions", "don't want to think too hard". Include 3 with typos.`,
    },

    // ── ESL/Typos/Accessibility (100 queries) ──
    {
      category: 'ESL: Spanish/Portuguese speakers',
      prompt: `Generate 25 queries from Spanish or Portuguese speaking users typing in English. Include Spanglish ("juego de estrategia for 2 players"), direct translations that sound awkward ("game of building of cities"), wrong prepositions, missing articles, gender-confused adjectives. Cover varied game interests.`,
    },
    {
      category: 'ESL: Asian language speakers',
      prompt: `Generate 25 queries from Chinese, Japanese, or Korean speakers typing in English. Include: literal translations, unusual word order, missing plurals, mixed scripts, romanized words mixed in, very formal phrasing, very short telegraphic style. Cover varied game interests.`,
    },
    {
      category: 'Typos and autocorrect',
      prompt: `Generate 25 queries with realistic typos and autocorrect errors. "stratagy", "cooperativ", "deck bilder", "dungeoncrawler", "2plyer", phone keyboard adjacent-key errors, autocorrect changing game names ("Catalan" instead of "Catan", "Wing spam" instead of "Wingspan"), missing spaces, double letters, swapped letters.`,
    },
    {
      category: 'Text-speak and abbreviations',
      prompt: `Generate 25 queries in text-speak or heavily abbreviated. "2p strat 30min", "coop 4p horror", "smth like catan but better lol", "quick game 4 lunch break pls", "need rec asap", "any1 kno good solo games??", ALL CAPS, no caps, excessive exclamation, hashtags, "ngl i just want smth fun".`,
    },

    // ── Multi-constraint queries (60 queries) ──
    {
      category: 'Multi-constraint: 2-3 constraints',
      prompt: `Generate 30 queries combining 2-3 specific constraints. "2 player cooperative under 30 min", "heavy strategy for 4 about ancient Rome", "quick party game for 8 people that's funny", "solo deck builder about space", "family game with tile placement under 45 min". Every combination should be different.`,
    },
    {
      category: 'Multi-constraint: 4+ constraints',
      prompt: `Generate 30 queries combining 4+ specific constraints. "2 player competitive area control about medieval warfare under an hour with miniatures", "cooperative fantasy dungeon crawler for 3-5 players between 1-2 hours medium complexity", "quick light party game for 6+ that involves bluffing and is funny". These should be realistic things someone would actually type.`,
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
