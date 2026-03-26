/**
 * Two-tier LLM parse cache with fuzzy matching.
 *
 * Tier 1: In-memory MemoryCache (sub-millisecond, single process)
 * Tier 2: Supabase llm_parse_cache table (persistent, cross-session)
 *
 * Lookup flow:
 * 1. Exact match in memory → instant hit
 * 2. Exact match in Supabase → hit, warm memory
 * 3. Fuzzy match in Supabase (Levenshtein < 15%) → hit, warm memory
 * 4. All miss → return null, caller should invoke LLM
 *
 * On store: writes to both tiers simultaneously.
 */

import { createClient } from '@supabase/supabase-js';
import { MemoryCache } from '@/lib/cache';
import type { ParsedPreferences } from './types';
import { normalizeText, isFuzzyMatch } from './normalize';

// ─── Config ──────────────────────────────────────────────────

const MEMORY_TTL_SECONDS = 3600; // 1 hour
const MEMORY_MAX_ENTRIES = 200;
const FUZZY_CANDIDATE_LIMIT = 30; // How many recent entries to check for fuzzy match

// ─── In-Memory Tier ──────────────────────────────────────────

const memoryCache = new MemoryCache<ParsedPreferences>(MEMORY_TTL_SECONDS, MEMORY_MAX_ENTRIES);

// ─── Supabase Client ─────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Look up a cached LLM parse result.
 * Checks memory → Supabase exact → Supabase fuzzy.
 * Returns null on complete miss.
 */
export async function getCachedParse(rawInput: string): Promise<ParsedPreferences | null> {
  const normalized = normalizeText(rawInput);
  if (!normalized) return null;

  // Tier 1: Memory (exact)
  const fromMemory = memoryCache.get(normalized);
  if (fromMemory) return fromMemory;

  // Tier 2: Supabase
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    // Exact match
    const { data: exactHit } = await supabase
      .from('llm_parse_cache')
      .select('parsed_result')
      .eq('normalized_input', normalized)
      .limit(1)
      .single();

    if (exactHit?.parsed_result) {
      const result = exactHit.parsed_result as ParsedPreferences;
      memoryCache.set(normalized, result); // Warm memory
      return result;
    }

    // Fuzzy match: fetch recent entries and compare
    const { data: candidates } = await supabase
      .from('llm_parse_cache')
      .select('normalized_input, parsed_result')
      .order('created_at', { ascending: false })
      .limit(FUZZY_CANDIDATE_LIMIT);

    if (candidates && candidates.length > 0) {
      for (const candidate of candidates) {
        if (isFuzzyMatch(normalized, candidate.normalized_input)) {
          const result = candidate.parsed_result as ParsedPreferences;
          memoryCache.set(normalized, result); // Warm memory with our key
          return result;
        }
      }
    }
  } catch (error) {
    console.warn('[LLM Cache] Supabase lookup failed:', error);
  }

  return null;
}

/**
 * Store an LLM parse result in both cache tiers.
 */
export async function setCachedParse(
  rawInput: string,
  result: ParsedPreferences,
): Promise<void> {
  const normalized = normalizeText(rawInput);
  if (!normalized) return;

  // Tier 1: Memory (always)
  memoryCache.set(normalized, result);

  // Tier 2: Supabase (best-effort)
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase
      .from('llm_parse_cache')
      .upsert({
        raw_input: rawInput,
        normalized_input: normalized,
        parsed_result: result,
        model: 'gpt-4o-mini',
      }, { onConflict: 'normalized_input' });
  } catch (error) {
    console.warn('[LLM Cache] Supabase write failed:', error);
  }
}
