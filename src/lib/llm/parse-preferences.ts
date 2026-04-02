/**
 * LLM-powered preference extraction using OpenAI GPT-4o-mini.
 *
 * Takes free-form user text and returns structured game preferences.
 * Uses JSON mode for guaranteed valid JSON. Temperature=0 for
 * deterministic outputs (important for caching).
 *
 * Cost: ~$0.0001 per call with GPT-4o-mini.
 */

import OpenAI from 'openai';
import type { ParsedPreferences } from './types';
import { EMPTY_PARSED } from './types';

const SYSTEM_PROMPT = `You are a game recommendation assistant. The user will describe what kind of game they want in free text. Extract structured preferences from their description.

Return a JSON object with these fields:
- "gameTypes": array of game types from ONLY these values: "board", "video", "word", "party", "card". Empty array if not mentioned.
- "genres": array of genre/category preferences. Use standard names like: "Strategy", "RPG", "Puzzle", "Action", "Adventure", "Horror", "Sci-Fi", "Fantasy", "Mystery", "Family", "Trivia", "Word Game", "Roguelike", "Roguelite", "Deck Building", "Metroidvania", "Platformer", "Open World", "Sandbox", "Shooter", "Fighting", "Racing", "Sports", "Survival", "Simulation", "City Builder", "Worker Placement", "Social Deduction", "Party", "Cooperative", "Campaign", "Legacy", "Cozy", "Indie", "Retro", "Narrative", "Tower Defense", "MMORPG", "JRPG", "Stealth", "Rhythm", "Visual Novel", "Farming", "Crafting", "Dungeon Crawler", "Soulslike", "Battle Royale", "Auto Battler", "Turn-Based", "Real-Time". Also include any other relevant genres.
- "mechanics": array of game mechanics like "Deck Building", "Worker Placement", "Area Control", "Dice Rolling", "Hand Management", "Set Collection", "Tile Placement", "Social Deduction", "Engine Building", "Push Your Luck", "Trick Taking", "Card Drafting", "Resource Management", "Roll and Write", "Hidden Role", "Route Building", "Auction", "Trading", "Drafting", "Modular Board", "Variable Player Powers", "Legacy", "Campaign", "Negotiation", "Pattern Building", "Network Building", "Bag Building", "Action Points", "Programmed Movement", "Asymmetric Powers".
- "moods": array from ONLY these values: "competitive", "cooperative", "chill", "brain-teaser", "social", "story-driven". Empty array if not mentioned.
- "complexity": object with "min" (1-5) and "max" (1-5), or null if not mentioned. 1=very simple/casual, 2=light, 3=medium, 4=heavy, 5=very complex.
- "playerCount": object with "min" and "max", or null if not mentioned. "solo" = {min:1, max:1}. "with my partner" = {min:2, max:2}. "group" = {min:3, max:6}.
- "timePresets": array from ONLY these values: "quick" (under 15min), "short" (15-30min), "medium" (30-60min), "long" (1-2hr), "epic" (2+hr). Empty array if not mentioned.
- "maxMinutes": if the user specifies an exact time limit in minutes, extract the number. "under 30 minutes" = 30, "about an hour" = 60, "quick 20 minute game" = 20. null if not mentioned.
- "timeStrictness": how strict is the time limit? "hard" if they say "under", "less than", "no more than", "no longer than", "max", "within". "soft" if they say "about", "around", "roughly", "approximately", "ish". null if not mentioned or if no specific time given.
- "similarTo": array of specific game names the user mentioned or compared to (e.g. "Catan", "Slay the Spire", "Wordle", "Hollow Knight"). Empty array if none. Include both board AND video games.
- "keywords": array of other relevant keywords that don't fit above but help find games (e.g. "replayable", "solo", "legacy", "campaign", "miniatures", "pixel art", "hand-drawn", "atmospheric", "procedural", "permadeath", "base-building", "exploration", "loot").
- "designers": array of game designer/author names the user mentioned (e.g. "Uwe Rosenberg", "Stefan Feld", "Vlaada Chvátil", "Reiner Knizia", "Hideo Kojima"). Empty array if no designers mentioned. Use full names.

Be generous in extraction — if the user implies something, include it. Examples:
- "something my kids would enjoy" → genres: ["Family"], moods: ["chill"], complexity: {min:1, max:2}
- "Something like Catan" → similarTo: ["Catan"], genres: ["Strategy"], mechanics: ["Trading", "Resource Management"]
- "a quick party game for 6 people" → gameTypes: ["board"], genres: ["Party"], timePresets: ["quick"], playerCount: {min:6, max:6}, moods: ["social"]
- "a metroidvania about bugs" → gameTypes: ["video"], genres: ["Metroidvania", "Platformer"], keywords: ["bugs", "insects", "exploration"], similarTo: ["Hollow Knight"]
- "something chill to play alone on the couch" → moods: ["chill"], playerCount: {min:1, max:1}, keywords: ["solo", "relaxing"]
- "we want to argue and betray each other" → moods: ["competitive", "social"], mechanics: ["Social Deduction", "Negotiation", "Hidden Role"]
- "I just want to build stuff" → genres: ["City Builder", "Simulation", "Sandbox"], mechanics: ["Engine Building"], keywords: ["building", "creative", "construction"]
- "a game like Stardew Valley but board game" → gameTypes: ["board"], similarTo: ["Stardew Valley"], genres: ["Farming", "Cozy"], moods: ["chill"]
- "games designed by Stefan Feld" → designers: ["Stefan Feld"], genres: ["Strategy"]
- "an Uwe Rosenberg worker placement" → designers: ["Uwe Rosenberg"], mechanics: ["Worker Placement"]

Handle typos naturally — "roguelkie" means "roguelike", "stategy" means "strategy", "metroidvnia" means "metroidvania".

Understand intensity and tone:
- "I NEED something hardcore" → complexity: {min:4, max:5}, keywords: ["hardcore", "challenging"]
- "something super easy" → complexity: {min:1, max:1.5}
- "kind of strategic" → genres: ["Strategy"], complexity: {min:2.5, max:4}

CRITICAL: Extract negative preferences. If the user says "NOT", "don't want", "no", "except", "without", or similar:
- "excludedGenres": genres/categories to AVOID
- "excludedMechanics": mechanics to AVOID

Examples of negative extraction:
- "strategy game but not area control" → genres: ["Strategy"], excludedMechanics: ["Area Control"]
- "something like Catan but less random" → similarTo: ["Catan"], excludedMechanics: ["Dice Rolling"], keywords: ["less luck"]
- "no war games or fighting" → excludedGenres: ["Wargame", "Fighting"]
- "vegetarian, no chicken" → This is NOT a game request, return mostly empty with keywords: ["vegetarian", "food"]
- "party game that isn't Cards Against Humanity" → genres: ["Party"], excludedGenres: ["Adult", "Crude Humor"]

INTENT MODIFIERS: Extract the user's priority/intensity for preferences.
- "intentModifiers": object with arrays:
  - "mustHave": things the user REQUIRES ("must have", "need", "has to be", "only", "definitely")
  - "niceToHave": things the user would prefer but aren't dealbreakers ("would be cool", "ideally", "bonus if", "preferably")
  - "avoid": things the user wants to minimize ("not too", "less", "avoid", "without much")
  - "emphasize": things the user wants MORE of ("really", "very", "extremely", "super", "highly")

Examples:
- "must have deck building, would be nice if cooperative" → intentModifiers: {mustHave: ["Deck Building"], niceToHave: ["Cooperative"], avoid: [], emphasize: []}
- "really strategic, not too random" → intentModifiers: {mustHave: [], niceToHave: [], avoid: ["random", "luck", "dice"], emphasize: ["strategic", "strategy"]}
- "I need a quick game, preferably funny" → intentModifiers: {mustHave: ["quick", "short play time"], niceToHave: ["funny", "humor"], avoid: [], emphasize: []}

COMPARISON STRUCTURE: When the user compares to a specific game, extract what they want to keep and change.
- "comparisonBase": object with:
  - "game": the reference game name
  - "keepAttributes": aspects of the reference game to preserve
  - "changeAttributes": aspects to change (often preceded by "but", "less", "more", "without")

Examples:
- "like Catan but less random and more strategic" → comparisonBase: {game: "Catan", keepAttributes: ["trading", "resource management", "building"], changeAttributes: ["less dice rolling", "more strategic depth"]}
- "something like Gloomhaven but shorter sessions" → comparisonBase: {game: "Gloomhaven", keepAttributes: ["dungeon crawler", "tactical combat", "cooperative"], changeAttributes: ["shorter play time", "less campaign commitment"]}
- "Slay the Spire as a board game" → comparisonBase: {game: "Slay the Spire", keepAttributes: ["deck building", "roguelike", "card combos"], changeAttributes: ["board game format"]}

Only include intentModifiers and comparisonBase if they can be meaningfully extracted. Omit them for simple queries like "deck building game".

Only include fields you can reasonably infer. Return empty arrays and null for unmentioned fields.`;

/** Timeout for OpenAI API calls */
const LLM_TIMEOUT_MS = 8000;

/**
 * Call GPT-4o-mini to extract structured preferences from free text.
 * Returns null on any failure (timeout, invalid response, etc.)
 */
export async function parsePreferencesWithLLM(
  text: string,
): Promise<ParsedPreferences | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[LLM] OPENAI_API_KEY not set, skipping LLM parsing');
    return null;
  }

  const openai = new OpenAI({ apiKey, timeout: LLM_TIMEOUT_MS });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return validateAndClean(parsed, text);
  } catch (error) {
    console.error('[LLM] Parse error:', error instanceof Error ? error.message : error);
    return null;
  }
}

// ─── Validation ──────────────────────────────────────────────

const VALID_GAME_TYPES = new Set(['board', 'video', 'word', 'party', 'card']);
const VALID_MOODS = new Set(['competitive', 'cooperative', 'chill', 'brain-teaser', 'social', 'story-driven']);
const VALID_TIME_PRESETS = new Set(['quick', 'short', 'medium', 'long', 'epic']);

/**
 * Validates and cleans LLM output, ensuring all fields have correct types
 * and values are from known enums where applicable.
 */
function validateAndClean(raw: Record<string, unknown>, originalText: string): ParsedPreferences {
  const result: ParsedPreferences = {
    gameTypes: filterArray(raw.gameTypes, (v) => VALID_GAME_TYPES.has(v)),
    genres: toStringArray(raw.genres),
    mechanics: toStringArray(raw.mechanics),
    moods: filterArray(raw.moods, (v) => VALID_MOODS.has(v)),
    complexity: validateRange(raw.complexity, 1, 5),
    playerCount: validateRange(raw.playerCount, 1, 99),
    timePresets: filterArray(raw.timePresets, (v) => VALID_TIME_PRESETS.has(v)),
    similarTo: toStringArray(raw.similarTo),
    keywords: toStringArray(raw.keywords),
    excludedGenres: toStringArray(raw.excludedGenres),
    excludedMechanics: toStringArray(raw.excludedMechanics),
    maxMinutes: typeof raw.maxMinutes === 'number' && raw.maxMinutes > 0 ? raw.maxMinutes : null,
    timeStrictness: raw.timeStrictness === 'hard' || raw.timeStrictness === 'soft' ? raw.timeStrictness : null,
    designers: toStringArray(raw.designers),
  };

  // Post-processing: extract time from original text if LLM missed it
  if (!result.maxMinutes) {
    const lower = originalText.toLowerCase();
    const timeMatch = lower.match(/(\d+)\s*(?:min|minutes|mins)/);
    if (timeMatch) {
      result.maxMinutes = parseInt(timeMatch[1], 10);
      // Detect strictness from surrounding words
      const beforeTime = lower.slice(0, timeMatch.index ?? 0);
      if (/(?:under|less than|no more than|no longer than|max|within|fewer than)\s*$/.test(beforeTime)) {
        result.timeStrictness = 'hard';
      } else if (/(?:about|around|roughly|approximately|~)\s*$/.test(beforeTime)) {
        result.timeStrictness = 'soft';
      } else {
        result.timeStrictness = 'soft'; // Default to soft if ambiguous
      }
    }
  }

  // Post-processing: board game mechanics should default gameType to "board"
  const BOARD_GAME_MECHANICS = ['deck building', 'worker placement', 'area control',
    'tile placement', 'engine building', 'hand management', 'set collection',
    'dice rolling', 'route building', 'trick taking', 'drafting', 'auction'];
  if (result.gameTypes.length === 0 && result.mechanics.length > 0) {
    const hasBoardMechanic = result.mechanics.some((m) =>
      BOARD_GAME_MECHANICS.some((bm) => m.toLowerCase().includes(bm))
    );
    if (hasBoardMechanic) {
      result.gameTypes = ['board'];
    }
  }

  return result;
}

function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function filterArray(val: unknown, predicate: (v: string) => boolean): string[] {
  return toStringArray(val).filter(predicate);
}

function validateRange(
  val: unknown,
  minBound: number,
  maxBound: number,
): { min: number; max: number } | null {
  if (!val || typeof val !== 'object') return null;
  const obj = val as Record<string, unknown>;
  const min = typeof obj.min === 'number' ? obj.min : null;
  const max = typeof obj.max === 'number' ? obj.max : null;
  if (min === null || max === null) return null;
  if (min < minBound || max > maxBound || min > max) return null;
  return { min, max };
}
