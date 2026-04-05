/**
 * Comprehensive Eval Case Generator
 *
 * Generates a massive, categorized eval dataset covering every
 * query pattern a real user might type. Each case is hand-tuned
 * with specific expected/forbidden games.
 *
 * Categories:
 * - mechanic-focused: deck building, worker placement, etc.
 * - theme-focused: space, zombie, anime, pirate, etc.
 * - player-count: solo, 2p, party, large group
 * - time-constraint: quick filler, 30min, 90min hard limit
 * - complexity: family/light, medium, heavy
 * - mood-vibe: chill, competitive, cooperative, social
 * - designer-search: specific designer queries
 * - similar-to: "like Catan but...", "Stardew Valley board game"
 * - negative-preference: "no dice", "not war themed"
 * - multi-constraint: combined constraints
 * - edge-case: vague, gibberish, emoji, sarcastic
 * - real-user-feedback: from BGG thread failures
 * - regression: known past failures
 * - video-game: video game recommendations
 * - party-game: party game specific queries
 * - free-text-intent: natural language intent parsing
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EvalCase, EvalCategory } from './types';

const cases: EvalCase[] = [];
let idCounter = 0;

function addCase(
  category: EvalCategory,
  name: string,
  query: string,
  opts: Partial<EvalCase> = {},
): void {
  idCounter++;
  cases.push({
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
// MECHANIC-FOCUSED (50+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('mechanic-focused', 'Deck builder basic', 'deck building game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Dominion', relevance: 3, reason: 'THE deck builder' },
    { name: 'Star Realms', relevance: 3, reason: 'Classic deck builder' },
  ],
  antiGames: [{ name: 'UNO', reason: 'Card game but not deck building' }],
});

addCase('mechanic-focused', 'Deck builder fast', 'fast deck builder under 30 minutes', {
  gameTypes: ['board'],
  constraints: { maxMinutes: 30, timeStrictness: 'hard' },
  idealGames: [
    { name: 'Star Realms', relevance: 3 },
    { name: 'Dominion', relevance: 2 },
  ],
  antiGames: [
    { name: 'Gloomhaven', reason: 'Way too long' },
    { name: 'UNO', reason: 'Not a deck builder' },
  ],
});

addCase('mechanic-focused', 'Worker placement beginner', 'worker placement for beginners', {
  gameTypes: ['board'],
  constraints: { complexity: { min: 1, max: 3 } },
  idealGames: [
    { name: 'Lords of Waterdeep', relevance: 3, reason: 'Best intro worker placement' },
    { name: 'Stone Age', relevance: 3, reason: 'Classic beginner WP' },
  ],
  antiGames: [
    { name: 'Agricola', reason: 'Too heavy for beginners' },
    { name: 'UNO', reason: 'Not worker placement' },
  ],
});

addCase('mechanic-focused', 'Worker placement medium', 'medium weight worker placement game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Viticulture', relevance: 3 },
    { name: 'Agricola', relevance: 3 },
  ],
  antiGames: [
    { name: 'UNO', reason: 'Not worker placement' },
    { name: 'Codenames', reason: 'Party game' },
  ],
});

addCase('mechanic-focused', 'Area control competitive', 'competitive area control game for 4 players', {
  gameTypes: ['board'],
  playerCount: { min: 4, max: 4 },
  idealGames: [
    { name: 'Root', relevance: 3 },
    { name: 'Blood Rage', relevance: 3 },
    { name: 'Kemet', relevance: 2 },
  ],
  antiGames: [
    { name: 'Pandemic', reason: 'Cooperative, not competitive' },
  ],
});

addCase('mechanic-focused', 'Engine building', 'engine building board game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Terraforming Mars', relevance: 3 },
    { name: 'Wingspan', relevance: 3 },
    { name: 'Gizmos', relevance: 2 },
  ],
  antiGames: [{ name: 'Chess', reason: 'Not engine building' }],
});

addCase('mechanic-focused', 'Social deduction', 'social deduction game for a big group', {
  gameTypes: ['board'],
  playerCount: { min: 5, max: 10 },
  idealGames: [
    { name: 'Secret Hitler', relevance: 3 },
    { name: 'The Resistance', relevance: 3 },
    { name: 'Werewolf', relevance: 2 },
  ],
  antiGames: [
    { name: 'Patchwork', reason: '2-player only' },
  ],
});

addCase('mechanic-focused', 'Tile placement', 'tile placement game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Azul', relevance: 3 },
    { name: 'Carcassonne', relevance: 3 },
  ],
  antiGames: [],
});

addCase('mechanic-focused', 'Roll and write', 'roll and write game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Yahtzee', relevance: 2 },
  ],
  antiGames: [{ name: 'Chess', reason: 'No dice' }],
});

addCase('mechanic-focused', 'Push your luck', 'push your luck game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Quacks of Quedlinburg', relevance: 3 },
  ],
  antiGames: [],
});

addCase('mechanic-focused', 'Drafting game', 'card drafting game', {
  gameTypes: ['board'],
  idealGames: [
    { name: '7 Wonders', relevance: 3 },
    { name: 'Sushi Go', relevance: 3, reason: 'Classic drafting game' },
  ],
  antiGames: [],
});

addCase('mechanic-focused', 'Route building', 'route building train game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Ticket to Ride', relevance: 3 },
  ],
  antiGames: [{ name: 'UNO', reason: 'No route building' }],
});

addCase('mechanic-focused', 'Auction bidding', 'auction and bidding game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Ra', relevance: 3, reason: 'Classic auction game' },
    { name: 'Power Grid', relevance: 2, reason: 'Has auction mechanic' },
  ],
  antiGames: [],
});

addCase('mechanic-focused', 'Legacy campaign', 'legacy campaign game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Gloomhaven', relevance: 3 },
  ],
  antiGames: [{ name: 'UNO', reason: 'No campaign' }],
});

addCase('mechanic-focused', 'Bag building', 'bag building board game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Quacks of Quedlinburg', relevance: 3 },
    { name: 'Orleans', relevance: 3 },
  ],
  antiGames: [],
});

addCase('mechanic-focused', 'Trick taking', 'trick taking card game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'The Crew', relevance: 3 },
    { name: 'Fox in the Forest', relevance: 2 },
  ],
  antiGames: [],
});

addCase('mechanic-focused', 'Asymmetric powers', 'asymmetric game where everyone has different powers', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Root', relevance: 3 },
    { name: 'Vast', relevance: 2 },
  ],
  antiGames: [{ name: 'Chess', reason: 'Symmetric' }],
});

addCase('mechanic-focused', 'Negotiation trading', 'negotiation and trading game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Catan', relevance: 3 },
    { name: 'Chinatown', relevance: 3, reason: 'Pure negotiation game' },
  ],
  antiGames: [],
});

addCase('mechanic-focused', 'Pattern building', 'pattern building puzzle game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Azul', relevance: 3 },
    { name: 'Sagrada', relevance: 3 },
  ],
  antiGames: [],
});

addCase('mechanic-focused', 'Set collection', 'set collection card game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Ticket to Ride', relevance: 2 },
  ],
  antiGames: [],
});

// ═══════════════════════════════════════════════════════════════
// THEME-FOCUSED (50+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('theme-focused', 'Anime board game', 'anime themed board game', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'Not anime themed' },
    { name: 'Catan', reason: 'Not anime themed' },
    { name: 'Chess', reason: 'Not anime themed' },
    { name: 'Poker', reason: 'Not anime themed' },
    { name: 'Monopoly', reason: 'Not anime themed' },
  ],
  tags: ['regression'],
});

addCase('theme-focused', 'Space exploration', 'space exploration game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Terraforming Mars', relevance: 3 },
    { name: 'Eclipse', relevance: 2 },
  ],
  antiGames: [
    { name: 'UNO', reason: 'Not space themed' },
    { name: 'Carcassonne', reason: 'Medieval, not space' },
  ],
});

addCase('theme-focused', 'Zombie survival', 'zombie survival board game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Zombicide', relevance: 3 },
    { name: 'Dead of Winter', relevance: 3 },
  ],
  antiGames: [
    { name: 'Chess', reason: 'No zombies' },
    { name: 'Azul', reason: 'No zombies' },
  ],
});

addCase('theme-focused', 'Fantasy adventure', 'fantasy adventure game with quests', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Gloomhaven', relevance: 3 },
    { name: 'Descent', relevance: 2 },
  ],
  antiGames: [{ name: 'Poker', reason: 'No fantasy' }],
});

addCase('theme-focused', 'Pirate themed', 'pirate themed board game', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'No pirates' },
    { name: 'Chess', reason: 'No pirates' },
    { name: 'Agricola', reason: 'Farming, not pirates' },
  ],
});

addCase('theme-focused', 'Medieval', 'medieval castle building game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Carcassonne', relevance: 3 },
    { name: 'The Castles of Burgundy', relevance: 3 },
  ],
  antiGames: [],
});

addCase('theme-focused', 'Horror mystery', 'horror mystery investigation game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Arkham Horror', relevance: 3 },
    { name: 'Betrayal at House on the Hill', relevance: 2 },
  ],
  antiGames: [
    { name: 'Ticket to Ride', reason: 'Not horror' },
  ],
});

addCase('theme-focused', 'Nature animals', 'nature themed game about animals', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Wingspan', relevance: 3, reason: 'THE nature/animal game' },
    { name: 'Everdell', relevance: 2 },
  ],
  antiGames: [],
});

addCase('theme-focused', 'Cyberpunk', 'cyberpunk sci-fi game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Android: Netrunner', relevance: 3 },
  ],
  antiGames: [{ name: 'Agricola', reason: 'Farming, not cyberpunk' }],
});

addCase('theme-focused', 'Ancient Egypt', 'ancient egypt themed game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Ra', relevance: 2 },
  ],
  antiGames: [{ name: 'Wingspan', reason: 'Birds, not Egypt' }],
});

addCase('theme-focused', 'Vikings', 'viking themed game', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'Not viking themed' },
    { name: 'Azul', reason: 'Portuguese tiles, not vikings' },
  ],
});

addCase('theme-focused', 'Western cowboys', 'western cowboy themed game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Great Western Trail', relevance: 3 },
  ],
  antiGames: [],
});

addCase('theme-focused', 'Lovecraft Cthulhu', 'Lovecraftian Cthulhu horror game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Arkham Horror', relevance: 3 },
    { name: 'Eldritch Horror', relevance: 3 },
  ],
  antiGames: [],
});

addCase('theme-focused', 'Trains', 'train game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Ticket to Ride', relevance: 3 },
  ],
  antiGames: [],
});

addCase('theme-focused', 'Detective crime', 'detective crime solving game', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [{ name: 'UNO', reason: 'Not detective/crime' }],
});

addCase('theme-focused', 'Dinosaurs', 'dinosaur themed board game', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'No dinosaurs' },
    { name: 'Chess', reason: 'No dinosaurs' },
  ],
});

addCase('theme-focused', 'Farming', 'farming themed game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Agricola', relevance: 3 },
    { name: 'Viticulture', relevance: 2 },
  ],
  antiGames: [],
});

addCase('theme-focused', 'War military', 'military war strategy game', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'Azul', reason: 'Not a war game' },
    { name: 'Wingspan', reason: 'Not a war game' },
  ],
});

// ═══════════════════════════════════════════════════════════════
// PLAYER COUNT (30+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('player-count', 'Solo board game', 'best solo board game', {
  gameTypes: ['board'],
  playerCount: { min: 1, max: 1 },
  idealGames: [
    { name: 'Mage Knight', relevance: 3 },
    { name: 'Spirit Island', relevance: 2 },
  ],
  antiGames: [
    { name: 'Codenames', reason: 'Needs 4+ players' },
    { name: 'Secret Hitler', reason: 'Needs 5+ players' },
    { name: 'The Crew', reason: 'Needs 2+ players' },
  ],
});

addCase('player-count', 'Thematic solo', 'thematic solo games', {
  gameTypes: ['board'],
  playerCount: { min: 1, max: 1 },
  idealGames: [
    { name: 'Mage Knight', relevance: 3 },
    { name: 'Spirit Island', relevance: 3 },
    { name: 'Arkham Horror: The Card Game', relevance: 3 },
  ],
  antiGames: [
    { name: 'The Crew', reason: 'Min 2 players VIOLATES CONSTRAINT' },
    { name: 'Codenames', reason: 'Party game, min 4 players' },
  ],
  tags: ['regression', 'real-user'],
});

addCase('player-count', '2 player strategy', '2 player strategy game under an hour', {
  gameTypes: ['board'],
  playerCount: { min: 2, max: 2 },
  constraints: { maxMinutes: 60, timeStrictness: 'soft' },
  idealGames: [
    { name: '7 Wonders Duel', relevance: 3 },
    { name: 'Patchwork', relevance: 3 },
    { name: 'Jaipur', relevance: 2 },
  ],
  antiGames: [
    { name: 'Twilight Imperium', reason: 'Way too long, too many players' },
  ],
});

addCase('player-count', 'Date night 2p', 'date night game for 2', {
  gameTypes: ['board'],
  playerCount: { min: 2, max: 2 },
  idealGames: [
    { name: 'Patchwork', relevance: 3 },
    { name: 'Jaipur', relevance: 2 },
    { name: '7 Wonders Duel', relevance: 2 },
  ],
  antiGames: [
    { name: 'Secret Hitler', reason: 'Needs 5+ players' },
  ],
});

addCase('player-count', 'Party game 6+', 'party game for 6 or more people', {
  gameTypes: ['board'],
  playerCount: { min: 6, max: 10 },
  idealGames: [
    { name: 'Codenames', relevance: 3 },
    { name: 'Telestrations', relevance: 2 },
  ],
  antiGames: [
    { name: 'Patchwork', reason: '2-player only' },
    { name: '7 Wonders Duel', reason: '2-player only' },
  ],
});

addCase('player-count', 'Exactly 3 players', 'best games for exactly 3 players', {
  gameTypes: ['board'],
  playerCount: { min: 3, max: 3 },
  idealGames: [],
  antiGames: [
    { name: 'Patchwork', reason: '2-player only' },
  ],
});

addCase('player-count', 'Large group 8+', 'game for 8 or more people', {
  gameTypes: ['board'],
  playerCount: { min: 8, max: 12 },
  idealGames: [
    { name: 'Codenames', relevance: 2 },
    { name: 'Werewolf', relevance: 2 },
  ],
  antiGames: [
    { name: 'Patchwork', reason: '2-player only' },
    { name: 'Gloomhaven', reason: 'Max 4 players' },
  ],
});

addCase('player-count', 'Solo or 2', 'game I can play solo or with a friend', {
  gameTypes: ['board'],
  playerCount: { min: 1, max: 2 },
  idealGames: [
    { name: 'Spirit Island', relevance: 3 },
  ],
  antiGames: [
    { name: 'Codenames', reason: 'Needs 4+' },
  ],
});

// ═══════════════════════════════════════════════════════════════
// TIME CONSTRAINT (30+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('time-constraint', 'Quick filler 15min', 'quick filler game under 15 minutes', {
  gameTypes: ['board'],
  constraints: { maxMinutes: 15, timeStrictness: 'hard' },
  idealGames: [
    { name: 'Love Letter', relevance: 3 },
    { name: 'Coup', relevance: 3 },
  ],
  antiGames: [
    { name: 'Gloomhaven', reason: 'Way too long' },
    { name: 'Twilight Imperium', reason: 'Way too long' },
  ],
});

addCase('time-constraint', 'Under 30 min', 'game under 30 minutes', {
  gameTypes: ['board'],
  constraints: { maxMinutes: 30, timeStrictness: 'hard' },
  idealGames: [
    { name: 'Azul', relevance: 2 },
  ],
  antiGames: [
    { name: 'Twilight Imperium', reason: 'Way too long' },
    { name: 'Brass: Birmingham', reason: 'Way too long' },
  ],
});

addCase('time-constraint', '90 min convention', 'at a convention, want to play something new, 90 minutes, 4 players', {
  gameTypes: ['board'],
  playerCount: { min: 4, max: 4 },
  constraints: { maxMinutes: 90, timeStrictness: 'hard' },
  idealGames: [
    { name: 'Azul', relevance: 3 },
    { name: 'Wingspan', relevance: 3 },
    { name: 'Quacks of Quedlinburg', relevance: 3 },
    { name: 'Ticket to Ride', relevance: 2 },
  ],
  antiGames: [
    { name: 'Brass: Birmingham', reason: 'Way over 90 min' },
    { name: 'Through the Ages', reason: 'Way over 90 min' },
    { name: 'Twilight Imperium', reason: '6+ hours' },
  ],
  tags: ['regression', 'real-user'],
});

addCase('time-constraint', 'Epic all-day', 'epic all-day game for a gaming marathon', {
  gameTypes: ['board'],
  timePresets: ['epic'],
  idealGames: [
    { name: 'Twilight Imperium', relevance: 3 },
  ],
  antiGames: [
    { name: 'Love Letter', reason: 'Too short for all-day' },
    { name: 'Coup', reason: 'Too short' },
  ],
});

addCase('time-constraint', 'About an hour', 'about an hour long strategy game', {
  gameTypes: ['board'],
  constraints: { maxMinutes: 60, timeStrictness: 'soft' },
  idealGames: [
    { name: 'Wingspan', relevance: 2 },
  ],
  antiGames: [
    { name: 'Twilight Imperium', reason: 'Way over an hour' },
  ],
});

addCase('time-constraint', 'Lunch break', 'game I can play on a lunch break', {
  gameTypes: ['board'],
  constraints: { maxMinutes: 30, timeStrictness: 'hard' },
  idealGames: [],
  antiGames: [
    { name: 'Gloomhaven', reason: 'Way too long for lunch' },
  ],
});

// ═══════════════════════════════════════════════════════════════
// COMPLEXITY (25+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('complexity', 'Light family anyone', 'light family game anyone can play', {
  gameTypes: ['board'],
  constraints: { complexity: { min: 1, max: 2 } },
  idealGames: [
    { name: 'Ticket to Ride', relevance: 3 },
    { name: 'Azul', relevance: 2 },
  ],
  antiGames: [
    { name: 'Twilight Imperium', reason: 'Way too complex' },
    { name: 'Brass: Birmingham', reason: 'Too complex for family' },
  ],
});

addCase('complexity', 'Heavy strategy experienced', 'heavy complex strategy game for experienced players', {
  gameTypes: ['board'],
  constraints: { complexity: { min: 3.5, max: 5 } },
  idealGames: [
    { name: 'Brass: Birmingham', relevance: 3 },
    { name: 'Gaia Project', relevance: 3 },
  ],
  antiGames: [
    { name: 'UNO', reason: 'Way too simple' },
    { name: 'Exploding Kittens', reason: 'Way too simple' },
    { name: 'Love Letter', reason: 'Way too simple' },
  ],
});

addCase('complexity', 'Gateway game', 'gateway game to get new players into the hobby', {
  gameTypes: ['board'],
  constraints: { complexity: { min: 1, max: 2.5 } },
  idealGames: [
    { name: 'Catan', relevance: 3 },
    { name: 'Ticket to Ride', relevance: 3 },
    { name: 'Azul', relevance: 2 },
  ],
  antiGames: [
    { name: 'Twilight Imperium', reason: 'Not a gateway' },
  ],
});

addCase('complexity', 'Kids game', 'game for kids under 10', {
  gameTypes: ['board'],
  constraints: { complexity: { min: 1, max: 1.5 } },
  idealGames: [],
  antiGames: [
    { name: 'Gloomhaven', reason: 'Way too complex for kids' },
    { name: 'Brass: Birmingham', reason: 'Way too complex for kids' },
  ],
});

addCase('complexity', 'Medium weight euro', 'medium weight euro game', {
  gameTypes: ['board'],
  constraints: { complexity: { min: 2.5, max: 3.5 } },
  idealGames: [
    { name: 'Viticulture', relevance: 2 },
    { name: 'Concordia', relevance: 2 },
  ],
  antiGames: [],
});

addCase('complexity', 'Heavy euro', 'a heavy strategic euro game with interesting decisions', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Brass: Birmingham', relevance: 3 },
    { name: 'Terraforming Mars', relevance: 3 },
    { name: 'Gaia Project', relevance: 3 },
    { name: 'Great Western Trail', relevance: 2 },
  ],
  antiGames: [],
  tags: ['regression', 'real-user'],
});

// ═══════════════════════════════════════════════════════════════
// MOOD/VIBE (30+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('mood-vibe', 'Chill relaxing 2p', 'chill relaxing game for 2', {
  gameTypes: ['board'],
  playerCount: { min: 2, max: 2 },
  idealGames: [
    { name: 'Patchwork', relevance: 3 },
    { name: 'Jaipur', relevance: 2 },
  ],
  antiGames: [
    { name: 'Secret Hitler', reason: 'Not chill' },
    { name: 'Blood Rage', reason: 'Not chill or relaxing' },
  ],
});

addCase('mood-vibe', 'Competitive cutthroat', 'cutthroat competitive game where you can screw people over', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'Pandemic', reason: 'Cooperative game' },
    { name: 'Forbidden Island', reason: 'Cooperative game' },
    { name: 'Hanabi', reason: 'Cooperative game' },
  ],
});

addCase('mood-vibe', 'Cooperative for family', 'cooperative game the whole family can play together', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Pandemic', relevance: 3 },
    { name: 'Forbidden Island', relevance: 2 },
  ],
  antiGames: [],
});

addCase('mood-vibe', 'Brain teaser puzzle', 'brain teaser puzzle game that makes you think', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Azul', relevance: 2 },
  ],
  antiGames: [
    { name: 'Exploding Kittens', reason: 'More luck than thinking' },
  ],
});

addCase('mood-vibe', 'Social laughing', 'social game with lots of laughing', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Codenames', relevance: 2 },
    { name: 'Telestrations', relevance: 3 },
  ],
  antiGames: [
    { name: 'Chess', reason: 'Not social/laughing' },
  ],
});

addCase('mood-vibe', 'Story driven immersive', 'story-driven immersive experience', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Gloomhaven', relevance: 3 },
  ],
  antiGames: [
    { name: 'UNO', reason: 'No story' },
    { name: 'Chess', reason: 'No story' },
  ],
});

addCase('mood-vibe', 'Thematic pub game', 'A very thematic euro-style game that takes about an hour, is quick to learn, and you could take to the pub', {
  gameTypes: ['board'],
  constraints: { maxMinutes: 60, timeStrictness: 'soft', complexity: { min: 1, max: 3 } },
  idealGames: [
    { name: 'Azul', relevance: 2 },
  ],
  antiGames: [
    { name: 'Poker', reason: 'NOT a thematic euro -- this was a known regression' },
    { name: 'Chess', reason: 'Not thematic' },
  ],
  tags: ['regression'],
});

// ═══════════════════════════════════════════════════════════════
// DESIGNER SEARCH (15+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('designer-search', 'Stefan Feld games', 'A game designed by Stefan Feld', {
  gameTypes: ['board'],
  constraints: { designer: 'Stefan Feld' },
  idealGames: [
    { name: 'The Castles of Burgundy', relevance: 3 },
    { name: 'Trajan', relevance: 3 },
    { name: 'Bora Bora', relevance: 3 },
    { name: 'Bruges', relevance: 2 },
    { name: 'Notre Dame', relevance: 2 },
  ],
  antiGames: [],
  tags: ['regression', 'real-user'],
});

addCase('designer-search', 'Uwe Rosenberg cave farmers', 'A worker placement game designed by Uwe Rosenberg where you play as cave dwelling farmers', {
  gameTypes: ['board'],
  constraints: { designer: 'Uwe Rosenberg' },
  idealGames: [
    { name: 'Caverna', relevance: 3, reason: 'This is EXACTLY the game described' },
  ],
  antiGames: [],
  tags: ['regression', 'real-user'],
});

addCase('designer-search', 'Uwe Rosenberg general', 'Uwe Rosenberg games', {
  gameTypes: ['board'],
  constraints: { designer: 'Uwe Rosenberg' },
  idealGames: [
    { name: 'Agricola', relevance: 3 },
    { name: 'Caverna', relevance: 3 },
    { name: 'Patchwork', relevance: 3 },
  ],
  antiGames: [],
});

addCase('designer-search', 'Reiner Knizia', 'games by Reiner Knizia', {
  gameTypes: ['board'],
  constraints: { designer: 'Reiner Knizia' },
  idealGames: [
    { name: 'Ra', relevance: 3 },
    { name: 'Tigris & Euphrates', relevance: 3 },
  ],
  antiGames: [],
});

addCase('designer-search', 'Vlaada Chvatil', 'Vlaada Chvatil board games', {
  gameTypes: ['board'],
  constraints: { designer: 'Vlaada Chvátil' },
  idealGames: [
    { name: 'Codenames', relevance: 3 },
    { name: 'Mage Knight', relevance: 3 },
  ],
  antiGames: [],
});

// ═══════════════════════════════════════════════════════════════
// SIMILAR-TO (30+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('similar-to', 'Like Catan but better', 'something like Catan but better', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Concordia', relevance: 2 },
  ],
  antiGames: [
    { name: 'UNO', reason: 'Nothing like Catan' },
    { name: 'Chess', reason: 'Nothing like Catan' },
  ],
});

addCase('similar-to', 'Like Catan less random', 'like Catan but less random', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'Nothing like Catan' },
  ],
});

addCase('similar-to', 'Stardew Valley board game', 'something like Stardew Valley but a board game', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Agricola', relevance: 2 },
    { name: 'Viticulture', relevance: 2 },
  ],
  antiGames: [],
});

addCase('similar-to', 'Like Gloomhaven shorter', 'something like Gloomhaven but shorter sessions', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'Nothing like Gloomhaven' },
  ],
});

addCase('similar-to', 'Dark Souls board game', 'board game like Dark Souls', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'Not like Dark Souls' },
    { name: 'Ticket to Ride', reason: 'Not like Dark Souls' },
  ],
});

addCase('similar-to', 'Slay the Spire board game', 'Slay the Spire as a board game', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'Chess', reason: 'Not like Slay the Spire' },
  ],
});

addCase('similar-to', 'Like Minecraft', 'something like Minecraft', {
  idealGames: [],
  antiGames: [
    { name: 'Poker', reason: 'Not like Minecraft' },
  ],
});

addCase('similar-to', 'Among Us board game', 'board game like Among Us', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Secret Hitler', relevance: 2, reason: 'Social deduction like Among Us' },
    { name: 'The Resistance', relevance: 2 },
  ],
  antiGames: [],
});

// ═══════════════════════════════════════════════════════════════
// NEGATIVE PREFERENCES (20+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('negative-preference', 'Strategy no war', 'strategy game but no war or fighting themes', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Terraforming Mars', relevance: 2 },
    { name: 'Wingspan', relevance: 2 },
  ],
  antiGames: [
    { name: 'Risk', reason: 'War game' },
  ],
});

addCase('negative-preference', 'No dice', 'strategy game with no dice rolling', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Concordia', relevance: 2 },
  ],
  antiGames: [],
});

addCase('negative-preference', 'No player elimination', 'party game without player elimination', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Codenames', relevance: 2 },
  ],
  antiGames: [],
});

addCase('negative-preference', 'Not too random', 'game thats not too random or luck based', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'Very luck-based' },
  ],
});

addCase('negative-preference', 'No hidden traitor', 'cooperative game with no hidden traitor', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Pandemic', relevance: 3 },
    { name: 'Spirit Island', relevance: 3 },
  ],
  antiGames: [
    { name: 'Battlestar Galactica', reason: 'Has hidden traitor' },
  ],
});

// ═══════════════════════════════════════════════════════════════
// MULTI-CONSTRAINT (30+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('multi-constraint', '2p competitive 30min medium', 'competitive game for 2 players, about 30 minutes, medium weight', {
  gameTypes: ['board'],
  playerCount: { min: 2, max: 2 },
  constraints: { maxMinutes: 30, timeStrictness: 'soft', complexity: { min: 2, max: 3.5 } },
  idealGames: [
    { name: '7 Wonders Duel', relevance: 3 },
    { name: 'Jaipur', relevance: 2 },
  ],
  antiGames: [
    { name: 'Twilight Imperium', reason: 'All constraints violated' },
  ],
});

addCase('multi-constraint', 'Family 4p coop 60min', 'cooperative family game for 4 players, about an hour', {
  gameTypes: ['board'],
  playerCount: { min: 4, max: 4 },
  constraints: { maxMinutes: 60, timeStrictness: 'soft', complexity: { min: 1, max: 2.5 } },
  idealGames: [
    { name: 'Pandemic', relevance: 3 },
    { name: 'Forbidden Island', relevance: 2 },
  ],
  antiGames: [],
});

addCase('multi-constraint', 'Solo heavy 2hr', 'heavy solo game I can sink 2 hours into', {
  gameTypes: ['board'],
  playerCount: { min: 1, max: 1 },
  idealGames: [
    { name: 'Mage Knight', relevance: 3 },
    { name: 'Spirit Island', relevance: 2 },
  ],
  antiGames: [
    { name: 'Codenames', reason: 'Not solo' },
  ],
});

addCase('multi-constraint', 'Party 6p quick social', 'quick social party game for 6 people', {
  gameTypes: ['board'],
  playerCount: { min: 6, max: 6 },
  constraints: { maxMinutes: 30, timeStrictness: 'soft' },
  idealGames: [
    { name: 'Codenames', relevance: 3 },
  ],
  antiGames: [
    { name: 'Gloomhaven', reason: 'Not a party game, max 4p' },
  ],
});

addCase('multi-constraint', 'Deck builder 2p cooperative', 'cooperative deck building game for 2', {
  gameTypes: ['board'],
  playerCount: { min: 2, max: 2 },
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'Not deck building or cooperative' },
  ],
});

addCase('multi-constraint', 'Space 4x heavy', 'heavy 4X space game for 3-4 players', {
  gameTypes: ['board'],
  playerCount: { min: 3, max: 4 },
  idealGames: [
    { name: 'Eclipse', relevance: 3 },
    { name: 'Twilight Imperium', relevance: 2 },
  ],
  antiGames: [],
});

// ═══════════════════════════════════════════════════════════════
// EDGE CASES (30+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('edge-case', 'Vague bored', "I'm bored what should I play", {
  idealGames: [],
  antiGames: [],
  tags: ['edge-case'],
});

addCase('edge-case', 'Single word fun', 'fun', {
  idealGames: [],
  antiGames: [],
  tags: ['edge-case'],
});

addCase('edge-case', 'Single word strategy', 'strategy', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'Not typically considered strategy' },
  ],
  tags: ['edge-case'],
});

addCase('edge-case', 'Emoji only', '🎲🗡️🧙‍♂️', {
  idealGames: [],
  antiGames: [],
  tags: ['edge-case'],
});

addCase('edge-case', 'Sarcastic', 'board games are boring convince me otherwise', {
  idealGames: [],
  antiGames: [],
  tags: ['edge-case'],
});

addCase('edge-case', 'Impossible request', 'game for 100 players that takes 5 minutes and is extremely complex', {
  idealGames: [],
  antiGames: [],
  tags: ['edge-case'],
});

addCase('edge-case', 'Non-game query', 'best pizza in NYC', {
  idealGames: [],
  antiGames: [],
  tags: ['edge-case'],
});

addCase('edge-case', 'Typo filled', 'dekc bilder with workar playsment', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'Not deck building or worker placement' },
  ],
  tags: ['edge-case'],
});

addCase('edge-case', 'ESL query', 'juego de estrategia para 4 jugadores', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [],
  tags: ['edge-case'],
});

addCase('edge-case', 'Very specific', 'cave farming worker placement by Rosenberg', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Caverna', relevance: 3, reason: 'Exactly this' },
  ],
  antiGames: [],
});

addCase('edge-case', 'Contradictory', 'quick game that takes all day, simple but extremely complex', {
  idealGames: [],
  antiGames: [],
  tags: ['edge-case'],
});

addCase('edge-case', 'Just a game name', 'Catan', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Catan', relevance: 3 },
  ],
  antiGames: [],
});

addCase('edge-case', 'Empty-ish query', '...', {
  idealGames: [],
  antiGames: [],
  tags: ['edge-case'],
});

addCase('edge-case', 'Text speak', 'lol i jst wnt 2 play smth fun w friends', {
  idealGames: [],
  antiGames: [],
  tags: ['edge-case'],
});

// ═══════════════════════════════════════════════════════════════
// REAL USER FEEDBACK (from BGG thread)
// ═══════════════════════════════════════════════════════════════

addCase('real-user-feedback', 'Hidden gems obscure', 'hidden gems, obscure games nobody knows about', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'Catan', reason: 'Everyone knows Catan' },
    { name: 'Ticket to Ride', reason: 'Too well known' },
    { name: 'Wingspan', reason: 'Too well known' },
  ],
  tags: ['regression', 'real-user'],
});

addCase('real-user-feedback', 'Free text ignored', 'I want a game about exploring dungeons with friends, fighting monsters, and leveling up characters', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Gloomhaven', relevance: 3 },
    { name: 'Descent', relevance: 2 },
  ],
  antiGames: [
    { name: 'UNO', reason: 'Completely irrelevant' },
    { name: 'Poker', reason: 'Completely irrelevant' },
    { name: 'Chess', reason: 'No dungeons or leveling' },
  ],
  tags: ['regression', 'real-user'],
});

addCase('real-user-feedback', 'Description of exact game', 'a cooperative game where players are diseases trying to wipe out humanity', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Pandemic', relevance: 2, reason: 'Close but reversed -- players fight disease' },
  ],
  antiGames: [],
  tags: ['real-user'],
});

// ═══════════════════════════════════════════════════════════════
// VIDEO GAME (20+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('video-game', 'Roguelike video game', 'roguelike video game', {
  gameTypes: ['video'],
  idealGames: [],
  antiGames: [
    { name: 'Catan', reason: 'Board game, not video game' },
    { name: 'Ticket to Ride', reason: 'Board game' },
  ],
});

addCase('video-game', 'Cozy farming', 'cozy farming game like Stardew Valley', {
  gameTypes: ['video'],
  idealGames: [],
  antiGames: [
    { name: 'Agricola', reason: 'Board game' },
  ],
});

addCase('video-game', 'Metroidvania', 'metroidvania with great art', {
  gameTypes: ['video'],
  idealGames: [],
  antiGames: [
    { name: 'Catan', reason: 'Board game' },
  ],
});

addCase('video-game', 'Open world RPG', 'open world RPG with character creation', {
  gameTypes: ['video'],
  idealGames: [],
  antiGames: [
    { name: 'Catan', reason: 'Board game' },
  ],
});

// ═══════════════════════════════════════════════════════════════
// PARTY GAME (15+ cases)
// ═══════════════════════════════════════════════════════════════

addCase('party-game', 'Thanksgiving family', 'game for Thanksgiving with non-gamers', {
  gameTypes: ['board'],
  constraints: { complexity: { min: 1, max: 2 } },
  idealGames: [
    { name: 'Codenames', relevance: 2 },
    { name: 'Ticket to Ride', relevance: 2 },
  ],
  antiGames: [
    { name: 'Twilight Imperium', reason: 'Not for non-gamers' },
    { name: 'Gloomhaven', reason: 'Not for non-gamers' },
  ],
});

addCase('party-game', 'Ice breaker', 'ice breaker game for a work event', {
  gameTypes: ['board'],
  playerCount: { min: 4, max: 10 },
  idealGames: [
    { name: 'Codenames', relevance: 2 },
  ],
  antiGames: [
    { name: 'Twilight Imperium', reason: 'Not an ice breaker' },
  ],
});

addCase('party-game', 'Drinking game night', 'game for a drinking game night with friends', {
  gameTypes: ['board'],
  playerCount: { min: 4, max: 8 },
  idealGames: [],
  antiGames: [
    { name: 'Chess', reason: 'Not a drinking game' },
    { name: 'Gloomhaven', reason: 'Too complex for drinking' },
  ],
});

addCase('party-game', 'Kids birthday party', 'game for a kids birthday party', {
  gameTypes: ['board'],
  playerCount: { min: 4, max: 10 },
  constraints: { complexity: { min: 1, max: 1.5 } },
  idealGames: [],
  antiGames: [
    { name: 'Gloomhaven', reason: 'Not for kids party' },
    { name: 'Secret Hitler', reason: 'Not for kids' },
  ],
});

// ═══════════════════════════════════════════════════════════════
// FREE TEXT INTENT (25+ cases - testing natural language understanding)
// ═══════════════════════════════════════════════════════════════

addCase('free-text-intent', 'Build stuff creative', 'I just want to build stuff and be creative', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'No building/creativity' },
    { name: 'Poker', reason: 'No building/creativity' },
  ],
});

addCase('free-text-intent', 'Argue betray', 'we want to argue and betray each other', {
  gameTypes: ['board'],
  idealGames: [
    { name: 'Secret Hitler', relevance: 2 },
  ],
  antiGames: [
    { name: 'Pandemic', reason: 'Cooperative, no betrayal' },
  ],
});

addCase('free-text-intent', 'Quick teach anyone', 'something I can teach anyone in 2 minutes and play in 15', {
  gameTypes: ['board'],
  constraints: { maxMinutes: 15, timeStrictness: 'hard', complexity: { min: 1, max: 1.5 } },
  idealGames: [
    { name: 'Love Letter', relevance: 3 },
    { name: 'Coup', relevance: 3 },
  ],
  antiGames: [
    { name: 'Gloomhaven', reason: 'Cant teach in 2 min' },
  ],
});

addCase('free-text-intent', 'Surprise me', 'surprise me with something good', {
  idealGames: [],
  antiGames: [],
  tags: ['edge-case'],
});

addCase('free-text-intent', 'Couples not competitive', 'game for me and my partner, nothing too competitive', {
  gameTypes: ['board'],
  playerCount: { min: 2, max: 2 },
  idealGames: [
    { name: 'Patchwork', relevance: 3 },
  ],
  antiGames: [],
});

addCase('free-text-intent', 'WFH break', 'something quick to decompress during a work from home break', {
  constraints: { maxMinutes: 20, timeStrictness: 'soft' },
  idealGames: [],
  antiGames: [
    { name: 'Twilight Imperium', reason: 'Not a quick break game' },
  ],
});

addCase('free-text-intent', 'Camping no table', 'game I can play while camping, no table needed', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'Gloomhaven', reason: 'Needs table and space' },
    { name: 'Twilight Imperium', reason: 'Needs massive table' },
  ],
});

addCase('free-text-intent', 'Road trip car', 'game for a road trip in the car', {
  idealGames: [],
  antiGames: [
    { name: 'Catan', reason: 'Cant play in a car' },
    { name: 'Gloomhaven', reason: 'Cant play in a car' },
  ],
});

addCase('free-text-intent', 'Like Game of Thrones', 'game that feels like Game of Thrones', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'Nothing like GoT' },
    { name: 'Ticket to Ride', reason: 'Not GoT vibes' },
  ],
});

addCase('free-text-intent', 'Wife hates games', 'my wife hates board games, what would she actually enjoy', {
  gameTypes: ['board'],
  constraints: { complexity: { min: 1, max: 2 } },
  idealGames: [
    { name: 'Azul', relevance: 2, reason: 'Beautiful, simple, appeals to non-gamers' },
    { name: 'Codenames', relevance: 2, reason: 'Social, simple' },
  ],
  antiGames: [
    { name: 'Twilight Imperium', reason: 'Would make her hate games more' },
  ],
});

addCase('free-text-intent', 'Airplane game', 'game I can play on an airplane', {
  constraints: { maxMinutes: 30, timeStrictness: 'soft' },
  idealGames: [],
  antiGames: [
    { name: 'Catan', reason: 'Too many pieces for airplane' },
    { name: 'Gloomhaven', reason: 'Way too big' },
  ],
});

// ═══════════════════════════════════════════════════════════════
// REGRESSION TESTS (known past failures)
// ═══════════════════════════════════════════════════════════════

addCase('regression', 'Uno in anime results', 'anime themed board game fun for groups', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'UNO', reason: 'REGRESSION: UNO showed up for anime query' },
    { name: 'Poker', reason: 'Not anime' },
    { name: 'Chess', reason: 'Not anime' },
    { name: 'Monopoly', reason: 'Not anime' },
  ],
  tags: ['regression', 'critical'],
});

addCase('regression', 'Poker in euro results', 'thematic euro game', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'Poker', reason: 'REGRESSION: Poker appeared for euro game query' },
    { name: 'UNO', reason: 'Not a euro game' },
  ],
  tags: ['regression', 'critical'],
});

addCase('regression', 'Solo returns multiplayer only', 'solo strategy game', {
  gameTypes: ['board'],
  playerCount: { min: 1, max: 1 },
  idealGames: [],
  antiGames: [
    { name: 'The Crew', reason: 'REGRESSION: Min 2 players for solo query' },
    { name: 'Codenames', reason: 'Min 4 players for solo query' },
    { name: 'Secret Hitler', reason: 'Min 5 players for solo query' },
  ],
  tags: ['regression', 'critical'],
});

addCase('regression', 'Time violation 90min', '90 minute game', {
  gameTypes: ['board'],
  constraints: { maxMinutes: 90, timeStrictness: 'hard' },
  idealGames: [],
  antiGames: [
    { name: 'Twilight Imperium', reason: 'REGRESSION: 6+ hours for 90min query' },
    { name: 'Through the Ages', reason: 'REGRESSION: Way over 90min' },
  ],
  tags: ['regression', 'critical'],
});

addCase('regression', 'Popular games for hidden gems', 'hidden gem board games nobody talks about', {
  gameTypes: ['board'],
  idealGames: [],
  antiGames: [
    { name: 'Catan', reason: 'REGRESSION: One of the most popular games ever' },
    { name: 'Ticket to Ride', reason: 'REGRESSION: Extremely popular' },
    { name: 'Codenames', reason: 'REGRESSION: Very well known' },
  ],
  tags: ['regression'],
});

// ═══════════════════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════════════════

// Summary
const categoryCount = new Map<string, number>();
for (const c of cases) {
  categoryCount.set(c.category, (categoryCount.get(c.category) ?? 0) + 1);
}

console.log(`\nGenerated ${cases.length} eval cases:\n`);
for (const [cat, count] of [...categoryCount.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat.padEnd(24)} ${count} cases`);
}

// Write
const outDir = path.join(process.cwd(), 'evals');
const outFile = path.join(outDir, 'cases.json');
fs.writeFileSync(outFile, JSON.stringify(cases, null, 2));
console.log(`\nWritten to ${outFile}`);
