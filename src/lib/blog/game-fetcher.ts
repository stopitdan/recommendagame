/**
 * Fetches topic-relevant games from the database for blog post generation.
 *
 * Two-pass query logic:
 *   Pass 1 — filter by topic category (exact), then mechanic fallback, then combine
 *   Pass 2 — broad high-rated fallback if still under 6 games
 *
 * Returns up to 8 randomly-selected games.
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { BlogGameRow } from './types';

const GAME_FIELDS =
  'id, name, rating, rating_count, categories, mechanics, min_players, max_players, avg_play_time, complexity, year_published, source, image_url, designers, enriched_metadata';

/** Minimum games we want before resorting to broader fallback queries. */
const MIN_GAMES = 6;

/** How many random games to return for the blog post. */
const PICK_COUNT = 8;

/**
 * Fetch topic-relevant games for a blog post.
 *
 * @param supabase  Authenticated Supabase client
 * @param topic     The topic template (only `category` is used here)
 * @param topicIndex  Index into the 365-day topic rotation — determines
 *                    whether this is a video-game crossover topic
 */
export async function fetchTopicGames(
  supabase: SupabaseClient,
  topic: { category: string | null },
  topicIndex: number,
): Promise<BlogGameRow[]> {
  const isVideoGameCrossover = topicIndex >= 341;

  let games: BlogGameRow[] = [];

  // --- Pass 1: category / mechanic exact match -------------------------
  if (topic.category) {
    const catQuery = supabase
      .from('games')
      .select(GAME_FIELDS)
      .gte('rating', 6.5)
      .gte('rating_count', 50)
      .eq('is_expansion', false)
      .contains('categories', [topic.category])
      .order('rating', { ascending: false })
      .limit(30);

    if (!isVideoGameCrossover) {
      catQuery.eq('source', 'bgg');
    }

    const { data: catGames } = await catQuery;

    if (catGames && catGames.length >= MIN_GAMES) {
      games = catGames;
    } else {
      // Mechanic fallback
      const mechQuery = supabase
        .from('games')
        .select(GAME_FIELDS)
        .gte('rating', 6.5)
        .gte('rating_count', 50)
        .eq('is_expansion', false)
        .contains('mechanics', [topic.category])
        .order('rating', { ascending: false })
        .limit(30);

      if (!isVideoGameCrossover) {
        mechQuery.eq('source', 'bgg');
      }

      const { data: mechGames } = await mechQuery;

      if (mechGames && mechGames.length >= MIN_GAMES) {
        games = mechGames;
      } else {
        // Combine whatever we found from both queries, deduped
        const combined = [...(catGames ?? []), ...(mechGames ?? [])];
        const seen = new Set<string>();
        games = combined.filter((g) => {
          if (seen.has(g.id)) return false;
          seen.add(g.id);
          return true;
        });
      }
    }
  }

  // --- Pass 2: broad fallback ------------------------------------------
  if (games.length < MIN_GAMES) {
    const broadQuery = supabase
      .from('games')
      .select(GAME_FIELDS)
      .gte('rating', 7.0)
      .gte('rating_count', 100)
      .eq('is_expansion', false)
      .order('rating', { ascending: false })
      .limit(50);

    if (!isVideoGameCrossover) {
      broadQuery.eq('source', 'bgg');
    }

    const { data: broadGames } = await broadQuery;

    if (broadGames) {
      const existingIds = new Set(games.map((g) => g.id));
      const extras = broadGames.filter((g) => !existingIds.has(g.id));
      games = [...games, ...extras];
    }
  }

  // Pick up to 8 random games
  const shuffled = games.sort(() => Math.random() - 0.5).slice(0, PICK_COUNT);
  return shuffled;
}
