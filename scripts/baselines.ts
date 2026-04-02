/**
 * Baseline Recommendation Systems for Comparison
 *
 * Three baselines to compare against our engine:
 * 1. Random: 10 random games from catalog
 * 2. Popularity: top 10 by rating_count
 * 3. Keyword: BM25-style text search on descriptions
 *
 * These establish the floor and naive ceiling for recommendation quality.
 * Our engine must significantly beat all three on NDCG@10.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

export interface BaselineResult {
  id: string;
  name: string;
  categories: string[];
  mechanics: string[];
  themes: string[];
  min_players: number | null;
  max_players: number | null;
  avg_play_time: number | null;
  complexity: number | null;
  rating: number | null;
  rating_count: number | null;
}

const GAME_COLUMNS = 'id, name, categories, mechanics, themes, min_players, max_players, avg_play_time, complexity, rating, rating_count';

/**
 * Random baseline: return 10 random games from the catalog.
 * This is the absolute floor -- any real system must beat this.
 */
export async function randomBaseline(
  gameTypes?: string[],
  limit: number = 10,
): Promise<BaselineResult[]> {
  const supabase = getSupabase();

  // Supabase doesn't have RANDOM() in PostgREST, so we use a large offset
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'estimated', head: true });

  const maxOffset = Math.max((count ?? 1000) - limit, 0);
  const randomOffset = Math.floor(Math.random() * maxOffset);

  let query = supabase
    .from('games')
    .select(GAME_COLUMNS)
    .gte('rating_count', 10) // minimum quality
    .range(randomOffset, randomOffset + limit - 1);

  if (gameTypes && gameTypes.length > 0) {
    query = query.overlaps('types', gameTypes);
  }

  const { data } = await query;
  return (data ?? []) as BaselineResult[];
}

/**
 * Popularity baseline: return top 10 games by rating_count.
 * This is what a naive "show popular games" system achieves.
 * Optionally filtered by game type.
 */
export async function popularityBaseline(
  gameTypes?: string[],
  playerCount?: { min: number; max: number },
  limit: number = 10,
): Promise<BaselineResult[]> {
  const supabase = getSupabase();

  let query = supabase
    .from('games')
    .select(GAME_COLUMNS)
    .order('rating_count', { ascending: false })
    .limit(limit);

  if (gameTypes && gameTypes.length > 0) {
    query = query.overlaps('types', gameTypes);
  }

  // Apply player count if specified
  if (playerCount) {
    query = query.lte('min_players', playerCount.max).gte('max_players', playerCount.min);
  }

  const { data } = await query;
  return (data ?? []) as BaselineResult[];
}

/**
 * Keyword baseline: BM25-style full-text search on game names and descriptions.
 * This is what a simple search engine would achieve without recommendation logic.
 */
export async function keywordBaseline(
  queryText: string,
  gameTypes?: string[],
  limit: number = 10,
): Promise<BaselineResult[]> {
  const supabase = getSupabase();

  // Use Postgres full-text search (websearch format handles natural language)
  let query = supabase
    .from('games')
    .select(GAME_COLUMNS)
    .textSearch('name', queryText, { type: 'websearch' })
    .order('rating_count', { ascending: false })
    .limit(limit);

  if (gameTypes && gameTypes.length > 0) {
    query = query.overlaps('types', gameTypes);
  }

  const { data: nameResults } = await query;

  // If name search returns enough, use those
  if (nameResults && nameResults.length >= limit) {
    return nameResults as BaselineResult[];
  }

  // Fallback: search with individual keywords in categories/mechanics/themes
  const keywords = queryText.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  if (keywords.length === 0) return (nameResults ?? []) as BaselineResult[];

  // Search categories and mechanics for keyword matches
  const results = new Map<string, BaselineResult>();
  for (const r of (nameResults ?? [])) {
    results.set(r.id, r as BaselineResult);
  }

  for (const keyword of keywords.slice(0, 5)) { // limit to 5 keywords
    let tagQuery = supabase
      .from('games')
      .select(GAME_COLUMNS)
      .or(`categories.cs.{${keyword}},mechanics.cs.{${keyword}},themes.cs.{${keyword}}`)
      .order('rating_count', { ascending: false })
      .limit(20);

    if (gameTypes && gameTypes.length > 0) {
      tagQuery = tagQuery.overlaps('types', gameTypes);
    }

    const { data: tagResults } = await tagQuery;
    for (const r of (tagResults ?? [])) {
      if (!results.has(r.id)) results.set(r.id, r as BaselineResult);
    }
  }

  // Sort by rating_count and return top N
  return [...results.values()]
    .sort((a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0))
    .slice(0, limit);
}
