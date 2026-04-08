/**
 * Fetches topic-relevant games from the database for blog post generation.
 *
 * Two-pass query logic:
 *   Pass 1 -- filter by topic category (exact), then mechanic fallback, then combine
 *   Pass 2 -- broad high-rated fallback if still under 6 games
 *
 * Topic-aware filters narrow results by player count or play time when the
 * title hint indicates constraints (e.g. "Solo", "Under 30 Minutes").
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

// ── Topic-Aware Filters ──────────────────────────────────────

interface TopicConstraints {
  maxPlayTime?: number;
  minMaxPlayers?: number;
  soloFriendly?: boolean;
  twoPlayer?: boolean;
}

/** Parse the title hint for player count / play time constraints. */
function parseTopicConstraints(titleHint: string): TopicConstraints {
  const lower = titleHint.toLowerCase();
  const constraints: TopicConstraints = {};

  // Solo / 1-player
  if (/\bsolo\b|\b1[- ]player\b|\balone\b|\bsingle[- ]player\b/.test(lower)) {
    constraints.soloFriendly = true;
  }

  // 2-player
  if (/\b2[- ]player\b|\btwo[- ]player\b|\bcouples?\b|\bhead[- ]to[- ]head\b|\bdueling\b/.test(lower)) {
    constraints.twoPlayer = true;
  }

  // Party / large group
  if (/\bparty\b|\b[5-9]\+?\s*players?\b|\blarge\s*group\b|\bbig\s*group\b/.test(lower)) {
    constraints.minMaxPlayers = 5;
  }

  // Quick / short play time
  if (/\bunder\s*15\s*min/.test(lower)) {
    constraints.maxPlayTime = 15;
  } else if (/\bunder\s*30\s*min|\bquick\b|\bfiller\b|\blunch\s*break/.test(lower)) {
    constraints.maxPlayTime = 30;
  } else if (/\bunder\s*45\s*min/.test(lower)) {
    constraints.maxPlayTime = 45;
  } else if (/\b20\s*min/.test(lower)) {
    constraints.maxPlayTime = 25;
  }

  return constraints;
}

/** Apply topic constraints to a Supabase query builder. */
function applyConstraints(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  constraints: TopicConstraints,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (constraints.soloFriendly) {
    query = query.lte('min_players', 1);
  }
  if (constraints.twoPlayer) {
    query = query.lte('min_players', 2).gte('max_players', 2);
  }
  if (constraints.minMaxPlayers) {
    query = query.gte('max_players', constraints.minMaxPlayers);
  }
  if (constraints.maxPlayTime) {
    query = query.lte('avg_play_time', constraints.maxPlayTime);
  }
  return query;
}

// ── Main Export ──────────────────────────────────────────────

/**
 * Fetch topic-relevant games for a blog post.
 *
 * @param supabase         Authenticated Supabase client
 * @param topic            The topic template (only `category` is used here)
 * @param titleHint        The resolved topic title (used for constraint parsing)
 * @param allowVideoGames  When true, include RAWG/IGDB games alongside BGG
 */
export async function fetchTopicGames(
  supabase: SupabaseClient,
  topic: { category: string | null },
  titleHint: string,
  allowVideoGames = false,
): Promise<BlogGameRow[]> {
  const constraints = parseTopicConstraints(titleHint);

  let games: BlogGameRow[] = [];

  // --- Pass 1: category / mechanic exact match -------------------------
  if (topic.category) {
    let catQuery = supabase
      .from('games')
      .select(GAME_FIELDS)
      .gte('rating', 6.5)
      .gte('rating_count', 50)
      .eq('is_expansion', false)
      .contains('categories', [topic.category])
      .order('rating', { ascending: false })
      .limit(30);

    if (!allowVideoGames) {
      catQuery = catQuery.eq('source', 'bgg');
    }
    catQuery = applyConstraints(catQuery, constraints);

    const { data: catGames } = await catQuery;

    if (catGames && catGames.length >= MIN_GAMES) {
      games = catGames;
    } else {
      // Mechanic fallback
      let mechQuery = supabase
        .from('games')
        .select(GAME_FIELDS)
        .gte('rating', 6.5)
        .gte('rating_count', 50)
        .eq('is_expansion', false)
        .contains('mechanics', [topic.category])
        .order('rating', { ascending: false })
        .limit(30);

      if (!allowVideoGames) {
        mechQuery = mechQuery.eq('source', 'bgg');
      }
      mechQuery = applyConstraints(mechQuery, constraints);

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
    let broadQuery = supabase
      .from('games')
      .select(GAME_FIELDS)
      .gte('rating', 7.0)
      .gte('rating_count', 100)
      .eq('is_expansion', false)
      .order('rating', { ascending: false })
      .limit(50);

    if (!allowVideoGames) {
      broadQuery = broadQuery.eq('source', 'bgg');
    }
    broadQuery = applyConstraints(broadQuery, constraints);

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
