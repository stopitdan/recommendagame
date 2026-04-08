/**
 * Semantic Recommendation Cache
 *
 * The "smart" cache layer. Instead of keying on raw user text, this
 * builds a canonical key from the PARSED, STRUCTURED preferences.
 * "Deck building games for 2 players" and "2 player deck builders"
 * both parse to the same structured prefs, producing the same key.
 *
 * Two-tier storage:
 *   1. Redis (10 min TTL) -- fast, volatile
 *   2. Supabase recommendation_cache table -- persistent, 24hr staleness
 *
 * Gets smarter as more people use the site: every unique preference
 * combo is cached, benefiting all future users with similar queries.
 */

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { redisCache } from '@/lib/redis';
import type { QuestionnaireState } from '@/types/questionnaire';

const REDIS_TTL = 600; // 10 minutes
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Canonical Key Building ─────────────────────────────────

/**
 * Build a deterministic canonical key from parsed/merged preferences.
 * The key deliberately excludes freeText -- only the structured result
 * of LLM parsing matters. Different text that parses to the same
 * structure produces the same key.
 */
export function buildCanonicalKey(
  prefs: QuestionnaireState & { userId?: string; collectionOnly?: boolean },
  popularity: string,
): string {
  const parsed = prefs.llmParsed;

  // Normalize: omit default/empty values to maximize cache hits.
  // A user who didn't specify complexity should match another who also didn't.
  const pcDefault = prefs.playerCount.min <= 1 && prefs.playerCount.max >= 8;
  const cxDefault = prefs.complexity.min <= 1 && prefs.complexity.max >= 5;

  const key: Record<string, unknown> = {};

  // Game types (sorted)
  const gt = [...prefs.gameTypes].sort();
  if (gt.length > 0) key.gt = gt;

  // Genres (merged with LLM-parsed, sorted)
  const g = [...prefs.genres].sort();
  if (g.length > 0) key.g = g;

  // Moods (sorted)
  const mo = [...prefs.moods].sort();
  if (mo.length > 0) key.mo = mo;

  // Player count (omit if default wide-open)
  if (!pcDefault) key.pc = prefs.playerCount;

  // Complexity (omit if default wide-open)
  if (!cxDefault) key.cx = prefs.complexity;

  // Time presets (sorted)
  const tp = [...prefs.timePresets].sort();
  if (tp.length > 0) key.tp = tp;

  // Popularity mode (omit if default)
  if (popularity !== 'popular') key.pop = popularity;

  // LLM-parsed fields that meaningfully change results
  if (parsed?.similarTo?.length) key.sim = [...parsed.similarTo].sort();
  if (parsed?.designers?.length) key.des = [...parsed.designers].sort();
  if (parsed?.keywords?.length) key.kw = [...parsed.keywords].sort();
  if (parsed?.franchiseSearch?.length) key.fr = [...parsed.franchiseSearch].sort();
  if (parsed?.excludedGenres?.length) key.exg = [...parsed.excludedGenres].sort();
  if (parsed?.excludedMechanics?.length) key.exm = [...parsed.excludedMechanics].sort();

  // Collection-only mode
  if (prefs.collectionOnly && prefs.userId) key.co = prefs.userId;

  return JSON.stringify(key);
}

/**
 * Hash a canonical key to a fixed-length string for DB lookups.
 */
export function hashCanonicalKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}

// ─── Cache Operations ───────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface CachedResult {
  payload: unknown;
  isStale: boolean;
}

/**
 * Look up a cached recommendation result.
 * Checks Redis first, then Supabase.
 * Returns null on complete miss.
 */
export async function getSemanticCache(hash: string): Promise<CachedResult | null> {
  // Tier 1: Redis (fast, 10 min TTL)
  const redisKey = `rec-sem:${hash}`;
  const redisHit = await redisCache.get<unknown>(redisKey);
  if (redisHit) {
    return { payload: redisHit, isStale: false };
  }

  // Tier 2: Supabase (persistent)
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data } = await supabase
      .from('recommendation_cache')
      .select('result_payload, updated_at, hit_count')
      .eq('canonical_key_hash', hash)
      .limit(1)
      .single();

    if (!data?.result_payload) return null;

    // Increment hit count (fire-and-forget)
    supabase
      .from('recommendation_cache')
      .update({ hit_count: (data.hit_count ?? 0) + 1 })
      .eq('canonical_key_hash', hash)
      .then(() => {});

    // Check staleness
    const updatedAt = new Date(data.updated_at).getTime();
    const isStale = Date.now() - updatedAt > STALE_THRESHOLD_MS;

    // Warm Redis cache (even if stale -- serve fast, recompute later)
    if (!isStale) {
      redisCache.set(redisKey, data.result_payload, REDIS_TTL);
    }

    return { payload: data.result_payload, isStale };
  } catch {
    return null;
  }
}

/**
 * Store a recommendation result in both cache tiers.
 */
export async function setSemanticCache(
  hash: string,
  prefs: Record<string, unknown>,
  result: unknown,
  resultCount: number,
): Promise<void> {
  // Tier 1: Redis
  const redisKey = `rec-sem:${hash}`;
  redisCache.set(redisKey, result, REDIS_TTL);

  // Tier 2: Supabase (best-effort)
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase
      .from('recommendation_cache')
      .upsert({
        canonical_key_hash: hash,
        preferences_summary: prefs,
        result_payload: result,
        result_count: resultCount,
        hit_count: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'canonical_key_hash' });
  } catch (err) {
    console.warn('[Semantic Cache] Supabase write failed:', err);
  }
}
