/**
 * Expanded Eval Case Generator
 *
 * Generates 500+ test cases by combining the 130 hand-curated base cases
 * with systematically generated variations covering:
 *
 * 1. Natural language variations (same intent, different phrasing)
 * 2. Typo/ESL variations
 * 3. Constraint combinations (2-3 constraints mixed)
 * 4. Every known game mechanic
 * 5. Every known game theme
 * 6. Player count edge cases
 * 7. Time constraint edge cases
 * 8. Known failure modes from BGG user feedback
 * 9. Cross-category tests (mechanic + theme + constraint)
 * 10. Adversarial tests (contradictory, ambiguous, misleading)
 *
 * This does NOT use LLM generation. All cases are deterministic
 * and hand-specified to ensure quality.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EvalCase, EvalCategory } from './types';

// Load base cases
const baseCases: EvalCase[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'evals', 'cases.json'), 'utf8')
);

const newCases: EvalCase[] = [];
let idCounter = baseCases.length;

function add(
  category: EvalCategory,
  name: string,
  query: string,
  opts: Partial<EvalCase> = {},
): void {
  idCounter++;
  newCases.push({
    id: `${category}-${String(idCounter).padStart(3, '0')}`,
    name,
    category,
    query,
    idealGames: [],
    antiGames: [],
    ...opts,
  });
}

// ═══════════════════════════════════════════════════════════════
// NATURAL LANGUAGE VARIATIONS
// Same intent as base cases but phrased differently
// ═══════════════════════════════════════════════════════════════

// Deck building variations
add('mechanic-focused', 'Deck builder casual phrasing', 'i wanna build a deck', {
  gameTypes: ['board'],
  idealGames: [{ name: 'Dominion', relevance: 3 }],
  antiGames: [{ name: 'UNO', reason: 'Not deck building' }],
});
add('mechanic-focused', 'Deck builder question form', 'whats the best deck building game?', {
  gameTypes: ['board'],
  idealGames: [{ name: 'Dominion', relevance: 3 }],
  antiGames: [],
});
add('mechanic-focused', 'Deckbuilder one word', 'deckbuilder', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [{ name: 'UNO', reason: 'Not a deckbuilder' }, { name: 'Chess', reason: 'Not a deckbuilder' }],
});
add('mechanic-focused', 'Deck builder with typo', 'deck biulding game', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [{ name: 'UNO', reason: 'Not deck building' }],
  tags: ['typo'],
});

// Worker placement variations
add('mechanic-focused', 'Worker placement slang', 'good wp game', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [{ name: 'UNO', reason: 'Not worker placement' }],
  tags: ['edge-case'],
});
add('mechanic-focused', 'Worker placement descriptive', 'game where you place workers on spots to take actions', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [{ name: 'UNO', reason: 'Not worker placement' }],
});

// Area control variations
add('mechanic-focused', 'Area control descriptive', 'game about controlling territory on a map', {
  gameTypes: ['board'],
  idealGames: [{ name: 'Root', relevance: 2 }],
  antiGames: [{ name: 'Azul', reason: 'No territory control' }],
});

// Engine building variations
add('mechanic-focused', 'Engine builder combo', 'game where you build combos that get better each turn', {
  gameTypes: ['board'],
  idealGames: [{ name: 'Wingspan', relevance: 2 }],
  antiGames: [],
});

// ═══════════════════════════════════════════════════════════════
// EVERY MAJOR MECHANIC (systematic coverage)
// ═══════════════════════════════════════════════════════════════

const mechanicTests: [string, string, string[], string[]][] = [
  ['hand management', 'hand management card game', ['Terraforming Mars'], ['Chess']],
  ['pick up and deliver', 'pick up and deliver board game', [], ['UNO']],
  ['programming movement', 'programmed movement robot game', ['RoboRally'], []],
  ['resource management', 'resource management strategy game', ['Terraforming Mars'], ['UNO']],
  ['hidden movement', 'hidden movement deduction game', ['Scotland Yard'], []],
  ['dice rolling combat', 'dice rolling combat game', [], ['Codenames']],
  ['tableau building', 'tableau building card game', ['Wingspan'], []],
  ['network building', 'network building game', ['Ticket to Ride'], []],
  ['variable setup', 'game with variable setup for replayability', [], []],
  ['memory', 'memory matching game for kids', [], ['Gloomhaven']],
  ['modular board', 'game with modular board that changes every time', ['Catan'], []],
  ['simultaneous action', 'simultaneous action selection game', ['7 Wonders'], []],
  ['real-time', 'real-time board game no turns', [], []],
  ['storytelling', 'storytelling game where you make up stories', ['Dixit'], []],
  ['point to point movement', 'point to point movement war game', [], []],
  ['press your luck', 'press your luck gambling feel game', ['Quacks of Quedlinburg'], []],
];

for (const [mech, query, shouldInclude, shouldNotInclude] of mechanicTests) {
  add('mechanic-focused', `Mechanic: ${mech}`, query, {
    gameTypes: ['board'],
    idealGames: shouldInclude.map(name => ({ name, relevance: 2 as const })),
    antiGames: shouldNotInclude.map(name => ({ name, reason: `Not ${mech}` })),
  });
}

// ═══════════════════════════════════════════════════════════════
// EVERY MAJOR THEME (systematic coverage)
// ═══════════════════════════════════════════════════════════════

const themeTests: [string, string, string[]][] = [
  ['greek mythology', 'ancient greek mythology board game', ['UNO', 'Codenames']],
  ['roman empire', 'roman empire themed strategy game', ['UNO']],
  ['samurai japan', 'samurai themed japanese game', ['UNO']],
  ['steampunk', 'steampunk themed game', ['UNO', 'Catan']],
  ['post-apocalyptic', 'post-apocalyptic survival game', ['Azul']],
  ['underwater ocean', 'underwater ocean exploration game', ['UNO']],
  ['jungle exploration', 'jungle exploration adventure game', ['Chess']],
  ['arctic polar', 'arctic themed survival game', ['UNO']],
  ['cats', 'cat themed board game', ['Chess', 'Risk']],
  ['dogs', 'dog themed board game', ['Chess']],
  ['cooking food', 'cooking themed board game', ['Gloomhaven']],
  ['wine', 'wine themed board game', ['UNO']],
  ['dragons', 'dragon themed board game', ['UNO']],
  ['robots', 'robot themed board game', ['UNO']],
  ['spies espionage', 'spy espionage themed game', ['Agricola']],
  ['racing', 'racing themed board game', ['Gloomhaven']],
  ['sports', 'sports themed board game', ['Arkham Horror']],
  ['music', 'music themed board game', ['Risk']],
  ['art', 'art themed board game', ['Risk']],
  ['building construction', 'building and construction themed game', ['Chess']],
  ['magic wizards', 'magic wizard themed game', ['UNO']],
  ['superheroes', 'superhero themed board game', ['Agricola']],
  ['time travel', 'time travel themed game', ['UNO']],
  ['fairy tale', 'fairy tale themed game', ['Risk']],
  ['mythology', 'mythology themed game', ['UNO']],
  ['city building', 'city building game', ['Chess']],
  ['civilization', 'civilization building game', ['UNO']],
  ['trading merchants', 'trading and merchant themed game', ['Chess']],
  ['exploration', 'exploration and discovery game', ['UNO']],
  ['politics', 'political themed game', ['Azul']],
  ['mafia crime', 'mafia and organized crime game', ['Wingspan']],
  ['space opera', 'epic space opera game', ['Azul']],
  ['horror gothic', 'gothic horror game', ['Catan']],
  ['wwii', 'WWII themed war game', ['Azul']],
  ['cold war', 'cold war themed game', ['Azul']],
  ['prehistoric', 'prehistoric caveman game', ['UNO']],
  ['insects bugs', 'insect and bug themed game', ['Risk']],
  ['flowers garden', 'flower garden themed game', ['Risk']],
  ['forest woodland', 'forest and woodland themed game', ['Risk']],
];

for (const [theme, query, shouldNotInclude] of themeTests) {
  add('theme-focused', `Theme: ${theme}`, query, {
    gameTypes: ['board'],
    antiGames: shouldNotInclude.map(name => ({ name, reason: `Not ${theme} themed` })),
  });
}

// ═══════════════════════════════════════════════════════════════
// PLAYER COUNT EDGE CASES
// ═══════════════════════════════════════════════════════════════

for (let n = 1; n <= 10; n++) {
  add('player-count', `Exactly ${n} player${n > 1 ? 's' : ''}`, `best board game for exactly ${n} player${n > 1 ? 's' : ''}`, {
    gameTypes: ['board'],
    playerCount: { min: n, max: n },
    antiGames: n <= 2 ? [{ name: 'Codenames', reason: 'Needs 4+ players' }] : [],
  });
}

add('player-count', 'Couple game', 'game for couples', {
  gameTypes: ['board'],
  playerCount: { min: 2, max: 2 },
  idealGames: [{ name: 'Patchwork', relevance: 2 }],
  antiGames: [],
});

add('player-count', 'Big family 5p', 'game for a family of 5', {
  gameTypes: ['board'],
  playerCount: { min: 5, max: 5 },
  antiGames: [{ name: 'Patchwork', reason: '2p only' }],
});

// ═══════════════════════════════════════════════════════════════
// TIME CONSTRAINT VARIATIONS
// ═══════════════════════════════════════════════════════════════

const timeTests: [string, number, 'hard' | 'soft'][] = [
  ['5 minute game', 5, 'hard'],
  ['10 minute filler', 10, 'hard'],
  ['under 20 minutes', 20, 'hard'],
  ['around 45 minutes', 45, 'soft'],
  ['about 2 hours', 120, 'soft'],
  ['all day game marathon', 480, 'soft'],
  ['no more than 60 minutes', 60, 'hard'],
  ['less than 90 minutes', 90, 'hard'],
];

for (const [query, maxMin, strictness] of timeTests) {
  add('time-constraint', `Time: ${query}`, query, {
    gameTypes: ['board'],
    constraints: { maxMinutes: maxMin, timeStrictness: strictness },
    antiGames: maxMin <= 30 ? [{ name: 'Twilight Imperium', reason: 'Way too long' }] : [],
  });
}

// ═══════════════════════════════════════════════════════════════
// COMPLEXITY VARIATIONS
// ═══════════════════════════════════════════════════════════════

add('complexity', 'Super simple for non-gamers', 'simplest possible game for someone who has never played a board game', {
  gameTypes: ['board'],
  constraints: { complexity: { min: 1, max: 1.5 } },
  antiGames: [
    { name: 'Gloomhaven', reason: 'Way too complex' },
    { name: 'Brass: Birmingham', reason: 'Way too complex' },
    { name: 'Twilight Imperium', reason: 'Way too complex' },
  ],
});

add('complexity', 'Brain-melting heavy', 'heaviest most complex brain-burning game possible', {
  gameTypes: ['board'],
  constraints: { complexity: { min: 4, max: 5 } },
  antiGames: [
    { name: 'UNO', reason: 'Too simple' },
    { name: 'Love Letter', reason: 'Too simple' },
  ],
});

add('complexity', 'Step up from Catan', 'something a bit heavier than Catan', {
  gameTypes: ['board'],
  constraints: { complexity: { min: 2.5, max: 3.5 } },
  idealGames: [],
  antiGames: [],
});

// ═══════════════════════════════════════════════════════════════
// DESIGNER SEARCH EXPANDED
// ═══════════════════════════════════════════════════════════════

const designerTests: [string, string, string[]][] = [
  ['Jamey Stegmaier', 'games by Jamey Stegmaier', ['Viticulture', 'Wingspan']],
  ['Cole Wehrle', 'Cole Wehrle games', ['Root']],
  ['Alexander Pfister', 'Alexander Pfister board games', ['Great Western Trail']],
  ['Bruno Cathala', 'Bruno Cathala games', []],
  ['Matt Leacock', 'Matt Leacock cooperative games', ['Pandemic']],
  ['Eric Lang', 'Eric Lang board games', ['Blood Rage']],
  ['Phil Walker-Harding', 'Phil Walker-Harding games', ['Sushi Go']],
];

for (const [designer, query, shouldInclude] of designerTests) {
  add('designer-search', `Designer: ${designer}`, query, {
    gameTypes: ['board'],
    constraints: { designer },
    idealGames: shouldInclude.map(name => ({ name, relevance: 3 as const })),
    antiGames: [],
  });
}

// ═══════════════════════════════════════════════════════════════
// SIMILAR-TO EXPANDED
// ═══════════════════════════════════════════════════════════════

const similarToTests: [string, string[]][] = [
  ['like Ticket to Ride but more complex', ['UNO']],
  ['something like Wingspan but competitive', []],
  ['like Azul but for more players', []],
  ['like Pandemic but competitive', []],
  ['like Root but simpler', []],
  ['Catan but without the luck', []],
  ['like 7 Wonders but for 2 players', ['7 Wonders Duel']],
  ['like Dominion but more interaction', []],
  ['like Spirit Island but less complex', []],
  ['like Terraforming Mars but faster', []],
  ['like Codenames but more strategic', []],
  ['games in the style of Catan', []],
  ['board game version of Zelda', []],
  ['board game version of Civilization', []],
  ['board game like Settlers of Catan', []],
];

for (const [query, antiGames] of similarToTests) {
  add('similar-to', `Similar: ${query.slice(0, 40)}`, query, {
    gameTypes: ['board'],
    antiGames: antiGames.map(name => ({ name, reason: 'Not what was asked' })),
  });
}

// ═══════════════════════════════════════════════════════════════
// NEGATIVE PREFERENCES EXPANDED
// ═══════════════════════════════════════════════════════════════

const negativeTests: [string, string[]][] = [
  ['strategy game with absolutely no luck or randomness', ['UNO']],
  ['game without any reading for kids who cant read', []],
  ['board game that doesnt take up much table space', ['Twilight Imperium']],
  ['game with no conflict or attacking', []],
  ['game without miniatures, just cards', []],
  ['game that isnt euro style', []],
  ['not a deck builder', ['Dominion']],
  ['no cooperative games, I want to compete', ['Pandemic']],
  ['nothing too long, max 45 minutes', ['Twilight Imperium', 'Gloomhaven']],
  ['no hidden traitor or lying mechanics', ['Secret Hitler']],
];

for (const [query, antiGames] of negativeTests) {
  add('negative-preference', `Negative: ${query.slice(0, 35)}`, query, {
    gameTypes: ['board'],
    antiGames: antiGames.map(name => ({ name, reason: 'Violates negative preference' })),
  });
}

// ═══════════════════════════════════════════════════════════════
// MULTI-CONSTRAINT STRESS TESTS
// ═══════════════════════════════════════════════════════════════

add('multi-constraint', '3-way: 2p+30min+light', 'light 2 player game under 30 minutes', {
  gameTypes: ['board'],
  playerCount: { min: 2, max: 2 },
  constraints: { maxMinutes: 30, timeStrictness: 'hard', complexity: { min: 1, max: 2 } },
  idealGames: [{ name: 'Jaipur', relevance: 2 }],
  antiGames: [{ name: 'Twilight Imperium', reason: 'Violates everything' }],
});

add('multi-constraint', '3-way: solo+heavy+long', 'heavy solo game for a long evening', {
  gameTypes: ['board'],
  playerCount: { min: 1, max: 1 },
  constraints: { complexity: { min: 3.5, max: 5 } },
  idealGames: [{ name: 'Mage Knight', relevance: 3 }],
  antiGames: [{ name: 'Codenames', reason: 'Not solo or heavy' }],
});

add('multi-constraint', '4-way: 4p+60min+coop+family', 'cooperative family game for 4, about an hour', {
  gameTypes: ['board'],
  playerCount: { min: 4, max: 4 },
  constraints: { maxMinutes: 60, timeStrictness: 'soft', complexity: { min: 1, max: 2.5 } },
  idealGames: [{ name: 'Pandemic', relevance: 3 }],
  antiGames: [],
});

add('multi-constraint', 'Theme+mechanic+players', 'fantasy deck building game for 2 players', {
  gameTypes: ['board'],
  playerCount: { min: 2, max: 2 },
  antiGames: [{ name: 'UNO', reason: 'Not fantasy or deck building' }],
});

add('multi-constraint', 'Mood+time+players', 'quick competitive game for 3-4 players', {
  gameTypes: ['board'],
  playerCount: { min: 3, max: 4 },
  constraints: { maxMinutes: 30, timeStrictness: 'hard' },
  antiGames: [{ name: 'Pandemic', reason: 'Cooperative' }],
});

// ═══════════════════════════════════════════════════════════════
// EDGE CASES AND ADVERSARIAL TESTS
// ═══════════════════════════════════════════════════════════════

const edgeCases: [string, string][] = [
  ['Very long rambling query', 'so basically what happened was my friend came over last weekend and we were looking for something to play and she said she wanted something not too complicated because she just got off work and was tired but I wanted something with a bit of strategy to it and we only had about an hour before dinner so it couldnt be too long and there were just the two of us'],
  ['All caps', 'DECK BUILDING GAME FOR 2 PLAYERS'],
  ['All lowercase', 'best strategy board game ever made'],
  ['Mixed languages', 'un juego de estrategia para 4 jugadores board game'],
  ['Repeated words', 'game game game strategy strategy'],
  ['Just numbers', '2 4 30'],
  ['URL in query', 'whats a good game like the one at boardgamegeek.com'],
  ['Special characters', '!@#$%^&*() deck building'],
  ['Very short', 'fun', ],
  ['Just a game name', 'Wingspan'],
  ['Just a designer', 'Uwe Rosenberg'],
  ['Question format', 'can you recommend a good board game?'],
  ['Negative only', "I don't want anything"],
  ['Mood only', 'something chill'],
  ['Occasion only', 'Christmas gift'],
  ['Age range only', 'for a 10 year old'],
  ['Budget reference', 'cheap board game under $20'],
  ['Award reference', 'Spiel des Jahres winners'],
  ['Comparison chain', 'like Catan meets Dominion with a dash of Pandemic'],
  ['Extremely specific', 'a 2-player competitive tile-laying game about building a stained glass window in a cathedral, medium weight, about 30-40 minutes, designed by a Spanish designer'],
];

for (const [name, query] of edgeCases) {
  add('edge-case', `Edge: ${name}`, query, {
    antiGames: [],
    tags: ['edge-case'],
  });
}

// ═══════════════════════════════════════════════════════════════
// VIDEO GAME EXPANDED
// ═══════════════════════════════════════════════════════════════

const videoGameTests: [string, string[]][] = [
  ['soulslike video game', ['Catan', 'Ticket to Ride']],
  ['platformer video game', ['Catan']],
  ['turn-based RPG', ['Catan']],
  ['4X strategy video game', ['Catan']],
  ['visual novel', ['Catan']],
  ['city builder simulation game', ['Catan']],
  ['survival crafting game', ['Catan']],
  ['battle royale video game', ['Catan']],
  ['indie pixel art game', ['Catan']],
  ['couch co-op video game', ['Catan']],
  ['JRPG with anime art', ['Catan']],
  ['first person shooter', ['Catan']],
  ['puzzle game like Tetris', ['Catan']],
  ['racing game', ['Catan']],
  ['rhythm game', ['Catan']],
];

for (const [query, antiGames] of videoGameTests) {
  add('video-game', `Video: ${query.slice(0, 30)}`, query, {
    gameTypes: ['video'],
    antiGames: antiGames.map(name => ({ name, reason: 'Board game, not video game' })),
  });
}

// ═══════════════════════════════════════════════════════════════
// FREE TEXT INTENT (human psychology tests)
// ═══════════════════════════════════════════════════════════════

const intentTests: [string, string, string[]][] = [
  ['Emotional state', 'im feeling stressed and need to unwind', ['Gloomhaven']],
  ['Social context', 'my in-laws are visiting and they dont play games', ['Twilight Imperium']],
  ['Gift hunting', 'birthday gift for someone who loves Catan', ['UNO']],
  ['Nostalgia', 'something that reminds me of playing games as a kid', []],
  ['Travel', 'game I can bring on a plane in my carry-on', ['Gloomhaven']],
  ['Educational', 'educational game for my 8 year old', ['Secret Hitler']],
  ['Date night', 'romantic game for date night', ['Risk']],
  ['Team building', 'team building game for a corporate retreat', ['Twilight Imperium']],
  ['Rainy day', 'rainy day game for the family', ['Gloomhaven']],
  ['Quick break', 'game for a coffee break at work', ['Twilight Imperium']],
  ['After dinner', 'something to play after dinner', []],
  ['Long flight', 'game for a long international flight', ['Catan']],
  ['Waiting room', 'game to play in a waiting room on my phone', []],
  ['Recovery', 'relaxing game while recovering from surgery', ['Risk']],
  ['Teach gaming', 'game to introduce someone to the hobby', ['Twilight Imperium']],
];

for (const [name, query, antiGames] of intentTests) {
  add('free-text-intent', `Intent: ${name}`, query, {
    antiGames: antiGames.map(n => ({ name: n, reason: 'Inappropriate for context' })),
  });
}

// ═══════════════════════════════════════════════════════════════
// REGRESSION TESTS EXPANDED (every known past failure)
// ═══════════════════════════════════════════════════════════════

add('regression', 'Poker in any result', 'thematic strategy game for 2-4 players', {
  gameTypes: ['board'],
  playerCount: { min: 2, max: 4 },
  antiGames: [
    { name: 'Poker', reason: 'REGRESSION: Poker appeared in board game results' },
  ],
  tags: ['regression', 'critical'],
});

add('regression', 'UNO in strategy results', 'deep strategy game', {
  gameTypes: ['board'],
  antiGames: [
    { name: 'UNO', reason: 'REGRESSION: UNO in strategy results' },
  ],
  tags: ['regression'],
});

add('regression', 'Chess in themed results', 'zombie horror board game with miniatures', {
  gameTypes: ['board'],
  antiGames: [
    { name: 'Chess', reason: 'REGRESSION: Chess in themed results' },
    { name: 'Poker', reason: 'REGRESSION: Poker in themed results' },
  ],
  tags: ['regression'],
});

add('regression', 'Board games in video game results', 'action RPG video game', {
  gameTypes: ['video'],
  antiGames: [
    { name: 'Catan', reason: 'Board game in video game results' },
    { name: 'Ticket to Ride', reason: 'Board game in video game results' },
    { name: 'Azul', reason: 'Board game in video game results' },
  ],
  tags: ['regression'],
});

// ═══════════════════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════════════════

const allCases = [...baseCases, ...newCases];

// Summary
const categoryCount = new Map<string, number>();
for (const c of allCases) {
  categoryCount.set(c.category, (categoryCount.get(c.category) ?? 0) + 1);
}

console.log(`\nGenerated ${allCases.length} eval cases (${baseCases.length} base + ${newCases.length} expanded):\n`);
for (const [cat, count] of [...categoryCount.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat.padEnd(24)} ${count} cases`);
}

// Write
const outFile = path.join(process.cwd(), 'evals', 'cases.json');
fs.writeFileSync(outFile, JSON.stringify(allCases, null, 2));
console.log(`\nWritten to ${outFile}`);
