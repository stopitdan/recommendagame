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
- "genres": array of genre/category preferences. Prefer these standard names: "Strategy", "RPG", "Puzzle", "Action", "Adventure", "Horror", "Sci-Fi", "Fantasy", "Mystery", "Family", "Trivia", "Word Game", "Roguelike", "Roguelite", "Deck Building", "Metroidvania", "Platformer", "Open World", "Sandbox", "Shooter", "Fighting", "Racing", "Sports", "Survival", "Simulation", "City Builder", "Worker Placement", "Social Deduction", "Party", "Cooperative", "Campaign", "Legacy", "Cozy", "Indie", "Retro", "Narrative". Also include any other relevant genres not in this list.
- "mechanics": array of game mechanics like "Deck Building", "Worker Placement", "Area Control", "Dice Rolling", "Hand Management", "Set Collection", "Tile Placement", "Social Deduction", "Engine Building", "Push Your Luck", "Trick Taking", "Card Drafting", "Resource Management", "Roll and Write", "Hidden Role", "Route Building", "Auction", "Trading", "Drafting", "Modular Board", "Variable Player Powers", "Legacy", "Campaign".
- "moods": array from ONLY these values: "competitive", "cooperative", "chill", "brain-teaser", "social", "story-driven". Empty array if not mentioned.
- "complexity": object with "min" (1-5) and "max" (1-5), or null if not mentioned. 1=very simple/casual, 2=light, 3=medium, 4=heavy, 5=very complex.
- "playerCount": object with "min" and "max", or null if not mentioned.
- "timePresets": array from ONLY these values: "quick" (under 15min), "short" (15-30min), "medium" (30-60min), "long" (1-2hr), "epic" (2+hr). Empty array if not mentioned.
- "similarTo": array of specific game names the user mentioned or compared to (e.g. "Catan", "Slay the Spire", "Wordle"). Empty array if none.
- "keywords": array of other relevant keywords that don't fit the above categories but could help find the right game (e.g. "replayable", "solo", "legacy", "campaign", "miniatures").

Be generous in extraction — if the user implies something, include it. For example:
- "something my kids would enjoy" → genres: ["Family"], moods: ["chill"], complexity: {min:1, max:2}
- "Something like Catan" → similarTo: ["Catan"], genres: ["Strategy"], mechanics: ["Trading", "Resource Management"]
- "a quick party game for 6 people" → gameTypes: ["board"], genres: ["Party"], timePresets: ["quick"], playerCount: {min:6, max:6}, moods: ["social"]

Handle typos naturally — "roguelkie" means "roguelike", "stategy" means "strategy".

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
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return validateAndClean(parsed);
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
function validateAndClean(raw: Record<string, unknown>): ParsedPreferences {
  return {
    gameTypes: filterArray(raw.gameTypes, (v) => VALID_GAME_TYPES.has(v)),
    genres: toStringArray(raw.genres),
    mechanics: toStringArray(raw.mechanics),
    moods: filterArray(raw.moods, (v) => VALID_MOODS.has(v)),
    complexity: validateRange(raw.complexity, 1, 5),
    playerCount: validateRange(raw.playerCount, 1, 99),
    timePresets: filterArray(raw.timePresets, (v) => VALID_TIME_PRESETS.has(v)),
    similarTo: toStringArray(raw.similarTo),
    keywords: toStringArray(raw.keywords),
  };
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
