/**
 * POST /api/recommend
 *
 * The main recommendation endpoint. Combines multiple layers:
 *
 *   Layer 1: Hybrid candidate fetching — 250 by pgvector similarity +
 *            250 by rating + text search, deduplicated
 *   Layer 2: Rule-based scoring — scores games on 9 weighted dimensions
 *   Layer 3: In-memory similarity re-ranking on top candidates
 *
 * The key innovation is hybrid candidate fetching: pgvector finds niche
 * games that match user preferences (e.g., actual roguelike deck builders),
 * while rating-based fetching ensures popular quality games are included.
 * This avoids the "top 500 by rating" trap where niche games get missed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import type { QuestionnaireState } from '@/types/questionnaire';
import { TIME_PRESETS } from '@/types/questionnaire';
import type { ParsedPreferences } from '@/lib/llm/types';
import { rowToGame, GAME_SELECT_COLUMNS } from '@/lib/supabase/games';
import {
  scoreGames,
  DEFAULT_WEIGHTS,
  POPULAR_WEIGHTS,
  HIDDEN_GEMS_WEIGHTS,
} from '@/lib/recommendation/scoring';
import type { ScoringWeights } from '@/lib/recommendation/scoring';
import { computeSimilarityInMemory, fetchVectorCandidates } from '@/lib/recommendation/similarity';
import { MemoryCache } from '@/lib/cache';
import { rateLimit, LIMITS } from '@/lib/rate-limit';
import { redisCache } from '@/lib/redis';
import { diversityRerank } from '@/lib/recommendation/diversity';
import { buildRejectionProfile, computeRejectionPenalty } from '@/lib/recommendation/rejection';
import { getPopularFallback } from '@/lib/recommendation/popularity-cache';
import { llmRerank } from '@/lib/recommendation/llm-rerank';
import { expandQuery } from '@/lib/recommendation/llm-query-expand';
import { getCollaborativeSignals } from '@/lib/recommendation/collaborative';
import { parsePreferencesWithLLM } from '@/lib/llm/parse-preferences';

// ─── Config ──────────────────────────────────────────────────

/** Per-source candidate limits */
const RELEVANCE_POOL_SIZE = 150; // tag/mechanic/text/designer searches
const POPULARITY_FALLBACK_SIZE = 50; // only used when relevance-based fetching finds < MIN_CANDIDATES
const MIN_CANDIDATES = 30; // threshold below which we add popularity fallback
const VECTOR_POOL_SIZE = 250;
const DEFAULT_RESULT_LIMIT = 100;
const MAX_RESULT_LIMIT = 200;
const SIMILARITY_CANDIDATES = 100;

// Rule vs. similarity blend. Shifted toward rules (was 55/45) because the
// cosine similarity rewards tag-matching obscure games equally with famous
// ones. The rule-based scoring includes popularity tiebreakers and adaptive
// weights that better surface canonical games for broad queries.
const RULE_WEIGHT = 0.65;
const SIMILARITY_WEIGHT = 0.35;

type PopularityMode = 'popular' | 'any' | 'hidden-gems';
// UI now only shows 'any' (default) and 'hidden-gems'.
// 'popular' is kept for backwards compat but treated as 'any'.

// ─── Caching ─────────────────────────────────────────────────

/** Cache recommendation results for identical preferences (2 min TTL) */
const recommendCache = new MemoryCache<unknown>(120, 50);

/** Generate a cache key from preferences */
function cacheKey(prefs: QuestionnaireState & { userId?: string; collectionOnly?: boolean }, popularity: string): string {
  return JSON.stringify({
    t: [...prefs.gameTypes].sort(),
    pc: prefs.playerCount,
    ta: [...prefs.timePresets].sort(),
    cx: prefs.complexity,
    g: [...prefs.genres].sort(),
    m: [...prefs.moods].sort(),
    ft: prefs.freeText,
    p: popularity,
    co: prefs.collectionOnly ? prefs.userId : undefined,
  });
}

// ─── DB Client ───────────────────────────────────────────────

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Route Handler ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  const blocked = await rateLimit(request, LIMITS.expensive);
  if (blocked) return blocked;

  let body: QuestionnaireState & {
    limit?: number;
    popularity?: PopularityMode;
    minRating?: number;
    minTime?: number;
    maxTime?: number;
    userId?: string;
    collectionOnly?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = createDbClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  // Server-side LLM parsing: always parse freeText server-side.
  // The client no longer sends llmParsed in URLs (clean URLs).
  // Legacy bookmarks may still include it, but we always prefer a fresh parse.
  if (body.freeText && body.freeText.trim().length >= 5) {
    const fresh = await parsePreferencesWithLLM(body.freeText);
    if (fresh) {
      body.llmParsed = fresh;
      console.log(`[Recommend] LLM parsed: genres=${JSON.stringify(fresh.genres)} mechanics=${JSON.stringify(fresh.mechanics)} keywords=${JSON.stringify(fresh.keywords)}`);
    } else {
      console.warn('[Recommend] LLM parse returned null for:', body.freeText.slice(0, 80));
    }
  }

  // Merge LLM-parsed preferences into body BEFORE cache key computation.
  // Without this, the cache key uses body.genres=[] and all queries with the
  // same freeText share one stale cache entry regardless of what the LLM extracted.
  //
  // Game types: ONLY use LLM types if the user didn't explicitly select any.
  // User clicking a chip is a hard filter — LLM should never add extra types.
  if (body.llmParsed?.gameTypes?.length && body.gameTypes.length === 0) {
    body.gameTypes = body.llmParsed.gameTypes as typeof body.gameTypes;
  }
  if (body.llmParsed?.genres?.length) {
    body.genres = [...new Set([...body.genres, ...body.llmParsed.genres])];
  }
  if (body.llmParsed?.mechanics?.length) {
    const expanded = expandTagsWithAliases(body.llmParsed.mechanics);
    body.genres = [...new Set([...body.genres, ...expanded])];
  }
  if (body.llmParsed?.moods?.length) {
    body.moods = [...new Set([...body.moods, ...body.llmParsed.moods])];
  }
  // Merge LLM-parsed complexity if client sent default wide-open range
  if (body.llmParsed?.complexity && body.complexity.min === 1 && body.complexity.max === 5) {
    body.complexity = body.llmParsed.complexity;
  }
  // Merge LLM-parsed player count if client sent default wide-open range
  if (body.llmParsed?.playerCount && body.playerCount.min <= 1 && body.playerCount.max >= 8) {
    body.playerCount = body.llmParsed.playerCount;
  }

  const limit = Math.min(body.limit ?? DEFAULT_RESULT_LIMIT, MAX_RESULT_LIMIT);
  const popularity: PopularityMode = body.popularity ?? 'popular';

  // Check caches: Redis (persistent) → in-memory (warm start)
  const key = cacheKey(body, popularity);
  const redisKey = `rec:${key}`;

  // Skip cache if ?nocache=1 is in the request URL (for testing)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skipCache = (body as any)._nocache === true;

  if (!skipCache) {
    const memoryCached = recommendCache.get(key);
    if (memoryCached) {
      return NextResponse.json(memoryCached);
    }

    const redisCached = await redisCache.get<unknown>(redisKey);
    if (redisCached) {
      recommendCache.set(key, redisCached);
      return NextResponse.json(redisCached);
    }
  }

  const startTime = Date.now();
  console.log(`[Recommend] collectionOnly=${body.collectionOnly}, userId=${body.userId}`);

  try {
    // Step 0: If collection-only mode, SKIP all hybrid fetching and use owned games directly
    if (body.collectionOnly) {
      if (!body.userId) {
        return NextResponse.json({
          results: [], count: 0, totalCandidates: 0,
          engine: 'collection-no-user', collectionEmpty: true,
          message: 'Sign in to use My Collection',
        });
      }

      const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceUrl || !serviceKey) {
        return NextResponse.json({ error: 'Server config error' }, { status: 500 });
      }
      const serviceClient = createClient(serviceUrl, serviceKey);
      const { data: ownedData } = await serviceClient
        .from('user_owned_games')
        .select('game_id')
        .eq('user_id', body.userId);

      const ownedIds = ((ownedData ?? []) as { game_id: string }[]).map((r) => r.game_id);
      console.log(`[Recommend] Collection mode: ${ownedIds.length} owned game IDs`);

      if (ownedIds.length === 0) {
        return NextResponse.json({
          results: [], count: 0, totalCandidates: 0,
          engine: 'collection-empty', collectionEmpty: true,
          message: 'No games in your collection yet. Sync your BGG account or add games with the package icon.',
        });
      }

      // Fetch full game data for all owned games
      const { data: ownedGames } = await supabase
        .from('games')
        .select(GAME_COLUMNS)
        .in('id', ownedIds);

      let candidates = ((ownedGames ?? []) as GameRow[]).map(rowToGame);
      console.log(`[Recommend] Collection: ${candidates.length} games fetched from DB`);

      // Score them
      const weights = getWeightsForMode(popularity);
      const scored = scoreGames(candidates, body, weights);

      // LLM rerank ALL of them (small collection)
      const reranked = await llmRerank(scored, body, Math.min(limit, scored.length));

      const latencyMs = Date.now() - startTime;
      console.log(`[Recommend] Collection done in ${latencyMs}ms: ${candidates.length} owned → ${reranked.length} results`);

      const response = {
        results: reranked.slice(0, limit).map(({ game, score, reasons, breakdown }) => ({
          ...game,
          _score: Math.round(score * 1000) / 1000,
          _reasons: reasons,
          _breakdown: breakdown,
        })),
        count: Math.min(reranked.length, limit),
        totalCandidates: candidates.length,
        engine: 'collection-v1',
      };

      return NextResponse.json(response);
    }

    // Step 1: Relevance-first candidate fetching
    // ALL candidates come from relevance-based sources (vector, tags, text, mechanics, designers).
    // Popularity-based fetching is ONLY used as a fallback when relevance finds too few games.
    // This prevents UNO from appearing in every single recommendation.
    const extra = {
      minRating: body.minRating,
      minTime: body.minTime,
      maxTime: body.maxTime,
    };

    // LLM query expansion: creatively expand the user's intent into additional search terms
    const queryExpansion = body.freeText
      ? expandQuery(body.freeText)
      : Promise.resolve({ searchTerms: [], categories: [], mechanics: [], themes: [] });

    // Collect tags from LLM parsing + user genres for tag-based search
    const allTags = collectSearchTags(body);

    // Direct mechanic search
    const mechanicTerms = [
      ...(body.llmParsed?.mechanics ?? []),
      ...body.genres.filter((g: string) => BGG_MECHANIC_ALIASES[g.toLowerCase()]),
    ];
    const uniqueMechanicTerms = [...new Set(mechanicTerms)];
    const mechanicSearchPromise = uniqueMechanicTerms.length > 0
      ? withTimeout(fetchDirectMechanicMatches(supabase, uniqueMechanicTerms), 5000, [])
      : Promise.resolve([]);

    // Designer search
    const designerNames = body.llmParsed?.designers ?? [];
    const designerSearchPromise = designerNames.length > 0
      ? withTimeout(fetchDesignerCandidates(supabase, designerNames), 5000, [])
      : Promise.resolve([]);

    // Franchise/IP search: fetch games whose title matches a franchise name
    // (e.g., "Resident Evil" finds "Resident Evil: The Board Game")
    const franchiseNames = body.llmParsed?.franchiseSearch ?? [];
    const franchiseSearchPromise = franchiseNames.length > 0
      ? withTimeout(fetchFranchiseCandidates(supabase, franchiseNames), 5000, [])
      : Promise.resolve([]);

    // Canonical game injection: fetch universally-expected games for the query's
    // mechanics/genres (e.g., Dominion for "deck building"). Ensures famous games
    // enter the candidate pool even if vector/tag/text search misses them.
    const canonicalSearchPromise = withTimeout(fetchCanonicalGames(supabase, body), 3000, []);

    // Relevance-first: NO unconditional rating pool. All sources are preference-aware.
    const [vectorCandidates, textCandidates, tagCandidates, mechanicCandidates, designerCandidates, canonicalCandidates, franchiseCandidates] = await Promise.all([
      withTimeout(fetchVectorCandidates(body, { limit: VECTOR_POOL_SIZE, columns: GAME_COLUMNS, supabaseClient: supabase }), 8000, []),
      body.freeText && body.freeText.trim().length >= 3
        ? withTimeout(fetchTextSearchCandidates(supabase, body.freeText), 5000, [])
        : Promise.resolve([]),
      allTags.length > 0
        ? withTimeout(fetchTagCandidates(supabase, allTags, body), 5000, [])
        : Promise.resolve([]),
      mechanicSearchPromise,
      designerSearchPromise,
      canonicalSearchPromise,
      franchiseSearchPromise,
    ]);

    // Deduplicate: franchise > canonical > designer > mechanic > vector > tag > text
    const seen = new Set<string>();
    let candidates: ReturnType<typeof rowToGame>[] = [];

    for (const source of [franchiseCandidates, canonicalCandidates, designerCandidates, mechanicCandidates, vectorCandidates, tagCandidates, textCandidates]) {
      for (const g of source) {
        if (!seen.has(g.id)) { candidates.push(g); seen.add(g.id); }
      }
    }

    // Merge in LLM-expanded query results (creative search terms)
    const expanded = await queryExpansion;
    let expandedCount = 0;
    if (expanded.themes.length > 0 || expanded.categories.length > 0 || expanded.mechanics.length > 0) {
      const expandedTags = [...expanded.categories, ...expanded.mechanics, ...expanded.themes];
      const expandedCandidates = await withTimeout(
        fetchTagCandidates(supabase, expandTagsWithAliases(expandedTags), body),
        3000,
        [],
      );
      for (const g of expandedCandidates) {
        if (!seen.has(g.id)) { candidates.push(g); seen.add(g.id); expandedCount++; }
      }
    }
    if (expanded.searchTerms.length > 0) {
      const searchText = expanded.searchTerms.join(' ');
      const expandedText = await withTimeout(
        fetchTextSearchCandidates(supabase, searchText),
        3000,
        [],
      );
      for (const g of expandedText) {
        if (!seen.has(g.id)) { candidates.push(g); seen.add(g.id); expandedCount++; }
      }
    }

    // Popularity fallback: ONLY if relevance-based fetching found too few games.
    // This prevents popular-but-irrelevant games (UNO, Catan) from polluting niche queries.
    let popularityFallbackCount = 0;
    if (candidates.length < MIN_CANDIDATES) {
      const fallbackGames = await withTimeout(
        fetchCandidates(supabase, body, popularity, extra, POPULARITY_FALLBACK_SIZE),
        5000,
        [],
      );
      for (const g of fallbackGames) {
        if (!seen.has(g.id)) { candidates.push(g); seen.add(g.id); popularityFallbackCount++; }
      }
    }

    console.log(`[Recommend] Relevance-first pool: ${franchiseCandidates.length} franchise + ${canonicalCandidates.length} canonical + ${designerCandidates.length} designer + ${mechanicCandidates.length} mechanic + ${vectorCandidates.length} vector + ${tagCandidates.length} tag + ${textCandidates.length} text + ${expandedCount} expanded + ${popularityFallbackCount} popularity-fallback = ${candidates.length} unique`);

    // Progressive fallbacks (only if hybrid produced nothing)
    if (candidates.length === 0) {
      console.log('[Recommend] No results with type filter, dropping type constraint');
      candidates = await fetchCandidatesNoType(supabase, body, popularity);
    }

    if (candidates.length === 0) {
      console.log('[Recommend] No results with player count, dropping all constraints');
      candidates = await fetchCandidatesFallback(supabase, popularity);
    }

    if (candidates.length === 0) {
      console.log('[Recommend] Nuclear fallback — dropping quality floor');
      candidates = await fetchCandidatesNuclear(supabase);
    }

    // Popularity cache fallback (from Redis — instant, no DB query)
    if (candidates.length === 0) {
      console.log('[Recommend] Trying pre-computed popularity cache...');
      const popular = await getPopularFallback(body);
      if (popular.length > 0) {
        candidates = popular;
      }
    }

    // EMERGENCY: If still 0 after ALL fallbacks, grab literally anything
    if (candidates.length === 0) {
      console.error('[Recommend] EMERGENCY: All fallbacks returned 0 candidates. Serving raw top games.');
      const { data: emergency } = await supabase
        .from('games')
        .select(GAME_COLUMNS)
        .limit(50);
      if (emergency && emergency.length > 0) {
        candidates = (emergency as GameRow[]).map(rowToGame);
      }
    }

    // Step 1c: If LLM parsed "similarTo" game names, resolve them,
    // merge their tags into genres, AND bootstrap preferences from
    // the similar game's attributes (complexity, player count, etc.)
    if (body.llmParsed?.similarTo?.length) {
      const { tags: resolvedTags, games: similarGames } = await resolveSimilarToGames(supabase, body.llmParsed.similarTo);
      if (resolvedTags.length > 0) {
        body.genres = [...new Set([...body.genres, ...resolvedTags])];
      }
      // Bootstrap: inherit complexity/playerCount from similar game
      // if user didn't specify them explicitly
      bootstrapFromSimilarGames(body, similarGames);
    }

    // (LLM genre/mechanic/gameType merge already happened before cache key computation)

    // Step 2a: Hard constraint filtering — eliminate games that clearly violate preferences
    const beforeFilter = candidates.length;
    candidates = applyHardFilters(candidates, body);

    // Hidden gems mode: also filter out well-known games that slipped in via
    // vector/text/tag/mechanic searches (DB filters only apply to rating queries)
    if (popularity === 'hidden-gems') {
      candidates = candidates.filter((g) => {
        const tooPopular = (g.ratingCount ?? 0) >= 2000;
        const tooFamous = g.rankOverall != null && g.rankOverall > 0 && g.rankOverall <= 1000;
        const tooLowRating = (g.rating ?? 0) < 7.0;
        return !tooPopular && !tooFamous && !tooLowRating;
      });
    }

    console.log(`[Recommend] Hard filters: ${beforeFilter} → ${candidates.length} candidates`);

    // Step 2b: Rule-based scoring (fast, in-memory)
    const weights = getWeightsForMode(popularity);
    let scored = scoreGames(candidates, body, weights);

    // Step 2c: Genre relevance hard filter — if the user asked for specific genres,
    // eliminate games that scored 0 on genre match. UNO should never appear in
    // results for "anime themed board game" regardless of other scores.
    if (body.genres.length > 0) {
      const beforeGenreFilter = scored.length;
      const genreFiltered = scored.filter((s) => s.breakdown.genreMatch > 0);
      // Only apply if it doesn't eliminate too many results
      if (genreFiltered.length >= 10) {
        scored = genreFiltered;
        console.log(`[Recommend] Genre relevance filter: ${beforeGenreFilter} → ${scored.length} (removed ${beforeGenreFilter - scored.length} zero-genre-match games)`);
      }
    }

    // Step 3: In-memory similarity on top candidates only (skip if too few)
    // Use scored results (sorted by rule-based score) to pick the best candidates
    // for similarity re-ranking, not the arbitrary pool insertion order
    let engineVersion = vectorCandidates.length > 0 ? 'hybrid-vector-v2' : 'rule-based-v1';
    const topCandidates = scored.slice(0, SIMILARITY_CANDIDATES).map((s) => s.game);
    if (topCandidates.length >= 5) {
      const inMemory = computeSimilarityInMemory(body, topCandidates, topCandidates.length);
      const similarityMap = new Map(inMemory.map((s) => [s.game.id, s.similarity]));

      // Combine scores
      for (const item of scored) {
        const sim = similarityMap.get(item.game.id) ?? 0;
        item.score = item.score * RULE_WEIGHT + sim * SIMILARITY_WEIGHT;
      }
      scored.sort((a, b) => b.score - a.score);
      engineVersion = vectorCandidates.length > 0 ? 'hybrid-vector-v2' : 'hybrid-inmemory-v1';
    }

    // Step 3.5: Collaborative filtering boost (if user has feedback history)
    if (body.userId) {
      try {
        // Get user's liked game IDs from feedback
        const { data: positiveFeedback } = await supabase
          .from('user_game_feedback')
          .select('game_id')
          .eq('user_id', body.userId)
          .eq('rating', 1);

        const likedIds = (positiveFeedback ?? []).map((f: { game_id: string }) => f.game_id);
        if (likedIds.length > 0) {
          const cfSignals = await getCollaborativeSignals(body.userId, likedIds);
          if (cfSignals.size > 0) {
            for (const item of scored) {
              const cf = cfSignals.get(item.game.id);
              if (cf) {
                item.score += cf.score * 0.15; // 15% CF boost
                item.reasons.push(cf.reason);
              }
            }
            scored.sort((a, b) => b.score - a.score);
            console.log(`[Recommend] CF signals applied: ${cfSignals.size} game boosts`);
          }
        }
      } catch (err) {
        console.error('[Recommend] CF error (non-fatal):', err);
      }
    }

    // Step 4: Apply rejection penalties (if user has negative feedback)
    const rejectionProfile = await buildRejectionProfile(body.userId ?? null);
    if (rejectionProfile) {
      let penalizedCount = 0;
      for (const item of scored) {
        const penalty = computeRejectionPenalty(item.game, rejectionProfile);
        if (penalty > 0) {
          item.score *= (1 - penalty);
          penalizedCount++;
        }
      }
      scored.sort((a, b) => b.score - a.score);
      console.log(`[Recommend] Rejection profile: ${rejectionProfile.totalRejections} rejections, ${rejectionProfile.rejectedTags.size} tags, penalized ${penalizedCount}/${scored.length} games`);
    }

    // Step 5: LLM reranking — ask GPT-4o to pick the best matches from top 50 candidates
    const reranked = await llmRerank(scored, body, Math.min(limit, scored.length <= 80 ? scored.length : 25));

    // Step 6: Diversity re-ranking (prevent 20 strategy games in a row)
    const diversified = diversityRerank(reranked);

    // Step 7: Take top N
    const topResults = diversified.slice(0, limit);

    // Step 7.5: Exact name match pinning — if the user's free text is just
    // a game name (no modifier words like "like", "similar to"), pin the
    // exact-match game to position #1 so it's always the top result.
    if (body.freeText) {
      const ft = body.freeText.trim();
      const modifierPattern = /\b(like|similar\s+to|games?\s+like|such\s+as|but|with|for|and|more|better|other|instead\s+of)\b/i;
      if (ft.length >= 2 && !modifierPattern.test(ft)) {
        const normalized = ft.toLowerCase();
        const exactIdx = topResults.findIndex((r) => r.game.name.toLowerCase() === normalized);
        if (exactIdx > 0) {
          const [exact] = topResults.splice(exactIdx, 1);
          topResults.unshift(exact);
        } else if (exactIdx === -1) {
          // Exact match might be in the full scored list but missed the top N
          const fromScored = scored.find((r) => r.game.name.toLowerCase() === normalized);
          if (fromScored) {
            topResults.unshift(fromScored);
            topResults.pop(); // keep the count the same
          }
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[Recommend] Done in ${latencyMs}ms: ${candidates.length} candidates → ${topResults.length} results (${engineVersion})`);

    const response = {
      results: topResults.map(({ game, score, reasons, breakdown }) => ({
        ...game,
        _score: Math.round(score * 1000) / 1000,
        _reasons: reasons,
        _breakdown: breakdown,
      })),
      count: topResults.length,
      totalCandidates: candidates.length,
      engine: engineVersion,
      popularity,
      latencyMs,
      // Debug info: include LLM parse + merged genres so admin UI can inspect
      _debug: {
        llmParsed: body.llmParsed ?? null,
        mergedGenres: body.genres,
        mergedGameTypes: body.gameTypes,
      },
    };

    // Cache responses with results in both layers
    if (topResults.length > 0) {
      recommendCache.set(key, response);
      redisCache.set(redisKey, response, 120); // 2 min TTL in Redis
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Recommend] Error:', error);
    return NextResponse.json({ error: 'Recommendation failed' }, { status: 500 });
  }
}

// ─── Hard Constraint Filtering ──────────────────────────────

/**
 * Eliminate games that clearly violate user's explicit preferences.
 * These are dealbreakers: a 900-minute game when someone asked for 30 min
 * should never appear, regardless of how high it scores on other dimensions.
 *
 * We use generous margins (50% buffer) to avoid being too aggressive.
 */
function applyHardFilters(
  candidates: ReturnType<typeof rowToGame>[],
  prefs: QuestionnaireState & { llmParsed?: ParsedPreferences | null },
): ReturnType<typeof rowToGame>[] {
  let filtered = candidates;

  // Player count: eliminate games that can't support the user's group
  if (prefs.playerCount && (prefs.playerCount.min > 1 || prefs.playerCount.max < 10)) {
    filtered = filtered.filter((g) => {
      if (!g.playerCount) return true; // Unknown = keep
      return g.playerCount.max >= prefs.playerCount.min &&
             g.playerCount.min <= prefs.playerCount.max;
    });
  }

  // Time: eliminate games outside the user's time range.
  // Use exact maxMinutes from LLM parsing when available (more precise than presets).
  // Buffer depends on strictness: "hard" (under/less than) = 15 min grace,
  // "soft" (about/around) = 50% grace.
  const llmMaxMin = prefs.llmParsed?.maxMinutes;
  const llmStrictness = prefs.llmParsed?.timeStrictness;

  if (llmMaxMin) {
    const buffer = llmStrictness === 'hard' ? 15 : llmMaxMin * 0.5;
    const hardMax = llmMaxMin + buffer;
    filtered = filtered.filter((g) => {
      const gameTime = g.playTime?.average ?? g.playTime?.min;
      if (!gameTime) return true;
      return gameTime <= hardMax;
    });
  } else if (prefs.timePresets.length > 0) {
    const maxTime = Math.max(...prefs.timePresets.map((tp) => TIME_PRESETS[tp].maxMinutes));
    const hardMax = maxTime < 999 ? maxTime * 1.5 : Infinity;
    filtered = filtered.filter((g) => {
      const gameTime = g.playTime?.average ?? g.playTime?.min;
      if (!gameTime) return true;
      return gameTime <= hardMax;
    });
  }

  // Complexity: eliminate games outside the user's range (with 0.5 buffer)
  if (prefs.complexity && (prefs.complexity.min > 1 || prefs.complexity.max < 5)) {
    const minC = Math.max(0, prefs.complexity.min - 0.5);
    const maxC = Math.min(5, prefs.complexity.max + 0.5);
    filtered = filtered.filter((g) => {
      if (!g.complexity) return true; // Unknown = keep
      return g.complexity >= minC && g.complexity <= maxC;
    });
  }

  // Game type: if specified, eliminate wrong types
  if (prefs.gameTypes.length > 0) {
    filtered = filtered.filter((g) => {
      return g.types.some((t) => prefs.gameTypes.includes(t));
    });
  }

  // If user specified a single specific mechanic, hard-filter to games with that mechanic.
  // "deck building game" = they want ONLY deck builders, not a mix.
  if (prefs.llmParsed?.mechanics?.length === 1) {
    const targetMechanic = prefs.llmParsed.mechanics[0].toLowerCase();
    const aliases = BGG_MECHANIC_ALIASES[targetMechanic] ?? [prefs.llmParsed.mechanics[0]];
    const beforeMechFilter = filtered.length;
    const mechFiltered = filtered.filter((g) => {
      const gameMechanics = g.mechanics.map((m) => m.toLowerCase());
      return aliases.some((alias) => gameMechanics.some((gm) => gm.includes(alias.toLowerCase())));
    });
    // Only apply if it doesn't eliminate too many (keep at least 10)
    if (mechFiltered.length >= 5) {
      filtered = mechFiltered;
      console.log(`[Recommend] Strict mechanic filter: ${beforeMechFilter} → ${filtered.length} (${prefs.llmParsed.mechanics[0]})`);
    }
  }

  // Excluded genres/mechanics from LLM parsing (e.g., "no war games")
  const excluded = prefs.llmParsed;
  if (excluded?.excludedGenres?.length || excluded?.excludedMechanics?.length) {
    const exGenres = (excluded.excludedGenres ?? []).map((g) => g.toLowerCase());
    const exMechanics = (excluded.excludedMechanics ?? []).map((m) => m.toLowerCase());
    filtered = filtered.filter((g) => {
      const gameTags = [...g.categories, ...g.mechanics, ...g.themes].map((t) => t.toLowerCase());
      const hasExcluded = gameTags.some((t) =>
        exGenres.some((ex) => t.includes(ex)) || exMechanics.some((ex) => t.includes(ex))
      );
      return !hasExcluded;
    });
  }

  // If filtering removed too many candidates, keep at least the ones that pass
  // player count + game type (the hardest constraints) and relax the others.
  // Game type is NEVER relaxed — if a user clicked "Board", they must only see board games.
  if (filtered.length < 5 && candidates.length >= 5) {
    filtered = candidates.filter((g) => {
      // Game type: inviolable — user explicitly chose this
      if (prefs.gameTypes.length > 0 && !g.types.some((t) => prefs.gameTypes.includes(t))) {
        return false;
      }
      // Player count: hard constraint
      if (!prefs.playerCount || (prefs.playerCount.min <= 1 && prefs.playerCount.max >= 10)) return true;
      if (!g.playerCount) return true;
      return g.playerCount.max >= prefs.playerCount.min &&
             g.playerCount.min <= prefs.playerCount.max;
    });
  }

  // Remove clear variants/editions when the base game exists.
  // Only remove if the variant has FEWER ratings than the base (indicating
  // it's a secondary version, not a standalone hit).
  // This keeps "Zombicide: Black Plague" (17k ratings) alongside "Zombicide"
  // (20k ratings) since both are popular standalone games, but removes
  // "Dominion: Intrigue" (35k) when "Dominion" (96k) is present.
  const baseGameMap = new Map<string, number>(); // base name -> max rating count
  for (const g of filtered) {
    if (!g.name.includes(':')) {
      const key = g.name.toLowerCase();
      baseGameMap.set(key, Math.max(baseGameMap.get(key) ?? 0, g.ratingCount ?? 0));
    }
  }
  filtered = filtered.filter((g) => {
    if (!g.name.includes(':')) return true;
    const baseName = g.name.split(':')[0].trim().toLowerCase();
    const baseRatings = baseGameMap.get(baseName);
    if (baseRatings === undefined) return true; // No base game in pool, keep
    // Only remove if the variant has less than 60% of the base game's ratings
    // This keeps genuinely popular standalone sequels
    const myRatings = g.ratingCount ?? 0;
    return myRatings >= baseRatings * 0.6;
  });
  // Remove "X: Second Edition" when "X" exists
  const allNames = new Set(filtered.map((g) => g.name.toLowerCase()));
  filtered = filtered.filter((g) => {
    const lower = g.name.toLowerCase();
    if (lower.includes('second edition') || lower.includes('revised edition') || lower.includes('new edition')) {
      const stripped = lower.replace(/[:\-–]\s*(second|revised|new)\s*edition.*$/i, '').trim();
      if (allNames.has(stripped) && stripped !== lower) return false;
    }
    return true;
  });

  return filtered;
}

// ─── Candidate Fetching ──────────────────────────────────────

/** Column list for game queries — imported from shared constant */
const GAME_COLUMNS = GAME_SELECT_COLUMNS;

/**
 * Fetch candidates with MINIMAL hard constraints.
 *
 * Philosophy: the DB query casts a WIDE net. Only filters that make
 * a game physically unplayable (wrong player count) are hard constraints.
 * Everything else (type, time, complexity, genre) is handled by the
 * scoring engine, which ranks by relevance instead of excluding.
 *
 * This ensures users ALWAYS get results, even with unusual combinations.
 */
/**
 * Popularity-based fallback: fetches games by rating/popularity.
 * Only used when relevance-based sources return too few candidates.
 * The poolSize parameter controls how many games to fetch (kept small
 * to avoid drowning out relevant results).
 */
async function fetchCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  prefs: QuestionnaireState,
  popularity: PopularityMode,
  extra?: { minRating?: number; minTime?: number; maxTime?: number },
  poolSize: number = POPULARITY_FALLBACK_SIZE,
) {
  let query = supabase
    .from('games')
    .select(GAME_COLUMNS)
    .not('rating', 'is', null)
    .eq('is_expansion', false);

  // ── Quality floor (always applied) ──
  // Local/curated games have no rating_count — exempt them from the floor.
  if (popularity === 'hidden-gems') {
    query = query.lt('rating_count', 2000);
    query = query.or('rating_count.gte.20,source.eq.local');
    query = query.gte('rating', 7.0);
    query = query.or('rank_overall.is.null,rank_overall.gt.1000');
  } else {
    query = query.or('rating_count.gte.25,source.eq.local');
  }

  // ── Player count: HARD constraint ──
  if (prefs.playerCount) {
    query = query.lte('min_players', prefs.playerCount.max);
    query = query.gte('max_players', prefs.playerCount.min);
  }

  // ── Extra refine filters (from results page) ──
  if (extra?.minRating && extra.minRating > 0) query = query.gte('rating', extra.minRating);
  if (extra?.minTime && extra.minTime > 0) query = query.gte('avg_play_time', extra.minTime);
  if (extra?.maxTime && extra.maxTime < 300) query = query.lte('avg_play_time', extra.maxTime);

  // ── Game type: soft filter at DB level ──
  if (prefs.gameTypes.length === 1) {
    query = query.contains('types', [prefs.gameTypes[0]]);
  } else if (prefs.gameTypes.length > 1) {
    query = query.or(prefs.gameTypes.map((t: string) => `types.cs.{${t}}`).join(','));
  }

  const { data, error } = await query
    .order('rating', { ascending: false })
    .limit(poolSize);

  if (error) {
    console.error('[Recommend] DB popularity fallback error:', error);
    return [];
  }

  return ((data ?? []) as GameRow[]).map(rowToGame);
}

/**
 * Franchise/IP search: finds games whose title contains a franchise name.
 * Uses ILIKE for substring matching -- catches "Resident Evil: The Board Game",
 * "Resident Evil 2: The Board Game", etc. Ordered by popularity so well-known
 * entries surface first.
 */
async function fetchFranchiseCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  franchises: string[],
) {
  const results: GameRow[] = [];
  const seen = new Set<string>();

  for (const franchise of franchises.slice(0, 3)) {
    const { data } = await supabase
      .from('games')
      .select(GAME_COLUMNS)
      .ilike('name', `%${franchise}%`)
      .eq('is_expansion', false)
      .order('rating_count', { ascending: false, nullsFirst: false })
      .limit(20);

    for (const row of (data ?? []) as GameRow[]) {
      if (!seen.has(row.id)) { results.push(row); seen.add(row.id); }
    }
  }

  return results.map(rowToGame);
}

/**
 * Supplemental text search: finds games matching free text keywords
 * in name, categories, mechanics, or themes. Returns up to 50 results.
 */
async function fetchTextSearchCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  freeText: string,
) {
  // Three parallel searches: game name (full-text) + name (substring) + description keywords
  const trimmed = freeText.trim();

  const [nameResults, nameIlikeResults, descResults] = await Promise.all([
    // Full-text search on game name -- sort by popularity to surface well-known games
    supabase
      .from('games')
      .select(GAME_COLUMNS)
      .textSearch('name', trimmed, { type: 'websearch' })
      .eq('is_expansion', false)
      .order('rating_count', { ascending: false, nullsFirst: false })
      .limit(30),
    // Substring name search -- catches titles like "Resident Evil: The Board Game"
    // when full-text search tokenization fails to match multi-word franchise names
    supabase
      .from('games')
      .select(GAME_COLUMNS)
      .ilike('name', `%${trimmed}%`)
      .eq('is_expansion', false)
      .order('rating_count', { ascending: false, nullsFirst: false })
      .limit(20),
    // Description keyword search (top 2 meaningful words)
    fetchDescriptionMatches(supabase, trimmed),
  ]);

  const results: GameRow[] = [];
  const seen = new Set<string>();

  for (const row of (nameResults.data ?? []) as GameRow[]) {
    if (!seen.has(row.id)) { results.push(row); seen.add(row.id); }
  }
  for (const row of (nameIlikeResults.data ?? []) as GameRow[]) {
    if (!seen.has(row.id)) { results.push(row); seen.add(row.id); }
  }
  for (const row of descResults) {
    if (!seen.has(row.id)) { results.push(row); seen.add(row.id); }
  }

  return results.map(rowToGame);
}

/**
 * Searches game descriptions using full-text search RPC (GIN-indexed).
 * Replaces the old ILIKE approach that caused full table scans.
 */
async function fetchDescriptionMatches(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  freeText: string,
): Promise<GameRow[]> {
  const trimmed = freeText.trim();
  if (trimmed.length < 3) return [];

  const { data, error } = await supabase.rpc('search_games_by_description', {
    search_query: trimmed,
    result_limit: 30,
  });

  if (error || !data) return [];
  return data as GameRow[];
}

/**
 * Tag-based candidate retrieval: finds games whose categories,
 * mechanics, or themes match LLM-extracted tags.
 *
 * This is the key fix for "roguelike deck builder" — instead of hoping
 * the vector search finds it, we directly query for games tagged with
 * "Deck Building" or "Roguelike" using the existing GIN indexes.
 */
async function fetchTagCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tags: string[],
  prefs?: QuestionnaireState,
): Promise<ReturnType<typeof rowToGame>[]> {
  if (tags.length === 0) return [];

  // Separate mechanic tags from genre/theme tags for more targeted queries
  const mechanicTags = prefs?.llmParsed?.mechanics
    ? expandTagsWithAliases(prefs.llmParsed.mechanics)
    : [];
  const genreTags = tags.filter((t) => !mechanicTags.includes(t)).slice(0, 8);
  const limitedMechanics = mechanicTags.slice(0, 8);

  // Use all tags as fallback if separation yields nothing
  const catTags = genreTags.length > 0 ? genreTags : tags.slice(0, 8);
  const mechTags = limitedMechanics.length > 0 ? limitedMechanics : tags.slice(0, 8);

  // Split into 3 parallel queries (one per column)
  // Sort by rating_count (popularity) instead of rating — when we already know
  // the game matches by tag, we want the most well-known examples first.
  // This ensures Dominion appears before obscure deck builders with higher ratings.
  const [catResult, mechResult, themeResult] = await Promise.all([
    catTags.length > 0 ? supabase
      .from('games')
      .select(GAME_COLUMNS)
      .overlaps('categories', catTags)
      .eq('is_expansion', false)
      .order('rating_count', { ascending: false, nullsFirst: false })
      .limit(50) : Promise.resolve({ data: [], error: null }),
    mechTags.length > 0 ? supabase
      .from('games')
      .select(GAME_COLUMNS)
      .overlaps('mechanics', mechTags)
      .eq('is_expansion', false)
      .order('rating_count', { ascending: false, nullsFirst: false })
      .limit(50) : Promise.resolve({ data: [], error: null }),
    supabase
      .from('games')
      .select(GAME_COLUMNS)
      .overlaps('themes', catTags)
      .eq('is_expansion', false)
      .order('rating_count', { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  // Merge and deduplicate
  const seen = new Set<string>();
  const merged: ReturnType<typeof rowToGame>[] = [];
  for (const { data, error } of [catResult, mechResult, themeResult]) {
    if (error) {
      console.error('[Recommend] Tag search error:', error);
      continue;
    }
    for (const row of (data ?? []) as GameRow[]) {
      const game = rowToGame(row);
      if (!seen.has(game.id)) {
        seen.add(game.id);
        merged.push(game);
      }
    }
  }

  return merged;
}

/**
 * Collects all meaningful tags from user preferences and LLM parsing.
 * Used to drive tag-based candidate retrieval.
 */
/**
 * Direct mechanic match: finds games that have specific mechanics by
 * querying each BGG alias directly. This is the most reliable way to
 * get actual deck builders when someone asks for "deck building".
 */
async function fetchDirectMechanicMatches(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  mechanics: string[],
): Promise<ReturnType<typeof rowToGame>[]> {
  if (mechanics.length === 0) return [];

  // Expand mechanics to BGG names and deduplicate
  const bggMechanics = [...new Set(expandTagsWithAliases(mechanics))].slice(0, 12);

  // Single query using overlaps() instead of N separate contains() queries.
  // overlaps() matches games that have ANY of the listed mechanics (OR logic).
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .overlaps('mechanics', bggMechanics)
    .eq('is_expansion', false)
    .gte('rating_count', 100)
    .order('rating_count', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[Recommend] Mechanic search error:', error);
    return [];
  }

  const merged = ((data ?? []) as GameRow[]).map(rowToGame);
  console.log(`[Recommend] Direct mechanic search: ${merged.length} games for [${bggMechanics.join(', ')}]`);
  return merged;
}

/**
 * Fetch games by designer name(s). Uses the `designers` array column
 * with case-insensitive substring matching.
 */
async function fetchDesignerCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  designers: string[],
): Promise<ReturnType<typeof rowToGame>[]> {
  if (designers.length === 0) return [];

  // Case-insensitive designer matching: overlaps() is case-sensitive and fails
  // when LLM extracts "Stefan Feld" but DB stores "Stefan H. Feld".
  // Use parallel ilike queries on the text-cast designers array for each name.
  const designerNames = designers.slice(0, 5);
  const seen = new Set<string>();
  const results: GameRow[] = [];

  // Run searches in parallel for each designer name
  const searches = designerNames.map(async (name) => {
    // Use RPC-based text search on the designers column cast to text
    // This catches "Stefan Feld" matching "Stefan H. Feld" via substring
    const { data, error } = await supabase
      .from('games')
      .select(GAME_COLUMNS)
      .eq('is_expansion', false)
      .filter('designers::text', 'ilike', `%${name}%`)
      .order('rating_count', { ascending: false })
      .limit(50);

    if (error) {
      // Fallback to exact match if text cast doesn't work
      const fallback = await supabase
        .from('games')
        .select(GAME_COLUMNS)
        .eq('is_expansion', false)
        .overlaps('designers', [name])
        .order('rating_count', { ascending: false })
        .limit(50);
      return (fallback.data ?? []) as GameRow[];
    }
    return (data ?? []) as GameRow[];
  });

  const allResults = await Promise.all(searches);
  for (const rows of allResults) {
    for (const row of rows) {
      if (!seen.has(row.id)) { results.push(row); seen.add(row.id); }
    }
  }

  const merged = results.map(rowToGame);
  console.log(`[Recommend] Designer search: ${merged.length} games for [${designers.join(', ')}]`);
  return merged;
}

// BGG uses non-standard mechanic names. This map expands common LLM terms
// to the actual BGG mechanic strings so tag-based candidate fetching works.
const BGG_MECHANIC_ALIASES: Record<string, string[]> = {
  'deck building': ['Deck, Bag, and Pool Building', 'Deck Building'],
  'bag building': ['Deck, Bag, and Pool Building', 'Bag Building'],
  'pool building': ['Deck, Bag, and Pool Building'],
  'worker placement': ['Worker Placement', 'Worker Placement, Different Worker Types'],
  'area control': ['Area Control / Area Influence', 'Area Majority / Influence'],
  'area majority': ['Area Majority / Influence', 'Area Control / Area Influence'],
  'hand management': ['Hand Management'],
  'set collection': ['Set Collection'],
  'tile placement': ['Tile Placement'],
  'card drafting': ['Card Drafting', 'Drafting'],
  'drafting': ['Drafting', 'Card Drafting', 'Open Drafting'],
  'push your luck': ['Push Your Luck'],
  'engine building': ['Income', 'Increase Value of Unchosen Resources'],
  'trick taking': ['Trick-taking'],
  'social deduction': ['Hidden Roles', 'Traitor Game', 'Voting'],
  'hidden role': ['Hidden Roles', 'Traitor Game'],
  'route building': ['Route/Network Building', 'Network and Route Building'],
  'roll and write': ['Roll-and-Write'],
  'action points': ['Action Points', 'Action/Event'],
  'modular board': ['Modular Board'],
  'variable player powers': ['Variable Player Powers'],
  'legacy': ['Legacy Game', 'Campaign / Battle Card Driven'],
  'campaign': ['Campaign / Battle Card Driven', 'Legacy Game'],
  'cooperative': ['Cooperative Game', 'Semi-Cooperative Game'],
  'auction': ['Auction/Bidding', 'Auction: English'],
  'negotiation': ['Negotiation', 'Trading'],
  'pattern building': ['Pattern Building', 'Pattern Recognition'],
  'dungeon crawler': ['Scenario / Mission / Campaign Game', 'Modular Board', 'Variable Player Powers'],
  'dungeon crawl': ['Scenario / Mission / Campaign Game', 'Modular Board', 'Variable Player Powers'],
  'dice combat': ['Dice Rolling'],
  'dice-based combat': ['Dice Rolling'],
  'co-op': ['Cooperative Game', 'Semi-Cooperative Game'],
  'coop': ['Cooperative Game', 'Semi-Cooperative Game'],
  'exploration': ['Modular Board', 'Scenario / Mission / Campaign Game'],
  'combat': ['Take That', 'Player Elimination'],
  'resource management': ['Income', 'Increase Value of Unchosen Resources'],
  'bluffing': ['Bluffing'],
  'deduction': ['Deduction'],
  'pick up and deliver': ['Pick-up and Deliver'],
  'asymmetric': ['Variable Player Powers'],
  'tableau building': ['Tableau Building'],
  'betting': ['Auction/Bidding', 'Betting and Bluffing'],
};

function expandTagsWithAliases(tags: string[]): string[] {
  const expanded = new Set<string>();
  for (const tag of tags) {
    expanded.add(tag);
    const aliases = BGG_MECHANIC_ALIASES[tag.toLowerCase()];
    if (aliases) {
      for (const alias of aliases) expanded.add(alias);
    }
  }
  return [...expanded];
}

// ─── Canonical Games ────────────────────────────────────────
// Editorial overrides: universally-expected games for common queries.
// Netflix/Spotify pattern -- when users ask for a category, they expect
// the defining examples. The scoring + LLM reranker decide final order;
// this just ensures the canonical games enter the candidate pool.
const CANONICAL_GAMES: Record<string, string[]> = {
  'deck building': ['Dominion', 'Star Realms', 'Clank!'],
  'deck builder': ['Dominion', 'Star Realms', 'Clank!'],
  'worker placement': ['Agricola', 'Caverna', 'Lords of Waterdeep'],
  'area control': ['Root', 'Blood Rage', 'Inis'],
  'area majority': ['Root', 'Blood Rage', 'El Grande'],
  'cooperative': ['Pandemic', 'Spirit Island', 'Forbidden Island'],
  'co-op': ['Pandemic', 'Spirit Island', 'Forbidden Island'],
  'engine building': ['Terraforming Mars', 'Wingspan', 'Gizmos'],
  'social deduction': ['Codenames', 'Secret Hitler', 'The Resistance: Avalon'],
  'tile placement': ['Azul', 'Carcassonne', 'Sagrada'],
  'party': ['Codenames', 'Telestrations', 'Dixit', 'Wavelength'],
  'party game': ['Codenames', 'Telestrations', 'Dixit', 'Wavelength'],
  'trick taking': ['The Crew', 'Fox in the Forest', 'Skull King'],
  'route building': ['Ticket to Ride', 'Brass: Birmingham'],
  'roll and write': ['Yahtzee', 'Welcome To...', "That's Pretty Clever"],
  'push your luck': ['Quacks of Quedlinburg', 'King of Tokyo', 'Incan Gold'],
  'drafting': ['7 Wonders', 'Sushi Go!', 'Blood Rage'],
  'card drafting': ['7 Wonders', 'Sushi Go!', 'Blood Rage'],
  'set collection': ['Ticket to Ride', 'Jaipur', 'Splendor'],
  'deduction': ['Clue', 'Mysterium', 'Cryptid'],
  'bluffing': ["Coup", "Sheriff of Nottingham", "Cockroach Poker"],
  'legacy': ['Pandemic Legacy: Season 1', 'Gloomhaven', 'Charterstone'],
  'campaign': ['Gloomhaven', 'Pandemic Legacy: Season 1', 'Sleeping Gods'],
  'dungeon crawler': ['Gloomhaven', 'Descent', 'Mage Knight'],
  'dungeon crawl': ['Gloomhaven', 'Descent', 'Mage Knight'],
  'negotiation': ['Cosmic Encounter', 'Chinatown', 'Catan'],
  'auction': ['Ra', 'Power Grid', 'Modern Art'],
  'pattern building': ['Azul', 'Sagrada', 'Calico'],
  'abstract': ['Azul', 'Hive', 'Patchwork'],
  'abstract strategy': ['Azul', 'Hive', 'Patchwork'],
  'solo': ['Spirit Island', 'Mage Knight', 'Arkham Horror: The Card Game'],
  'two player': ['Patchwork', '7 Wonders Duel', 'Jaipur'],
  '2 player': ['Patchwork', '7 Wonders Duel', 'Jaipur'],
};

/**
 * Fetch canonical games by name for mechanics/genres/moods/keywords that
 * match the CANONICAL_GAMES map. Returns up to 3 games per matched key.
 */
async function fetchCanonicalGames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  prefs: QuestionnaireState,
): Promise<ReturnType<typeof rowToGame>[]> {
  const names = new Set<string>();

  // Collect canonical game names from all matching keys
  const searchTerms = [
    ...(prefs.llmParsed?.mechanics ?? []),
    ...(prefs.llmParsed?.genres ?? []),
    ...(prefs.llmParsed?.keywords ?? []),
    ...prefs.genres,
    ...prefs.moods,
  ];

  for (const term of searchTerms) {
    const canonical = CANONICAL_GAMES[term.toLowerCase()];
    if (canonical) {
      for (const name of canonical.slice(0, 3)) names.add(name);
    }
  }

  if (names.size === 0) return [];

  // Fetch by exact name match (case-insensitive)
  const nameList = [...names];
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .in('name', nameList)
    .eq('is_expansion', false)
    .limit(nameList.length);

  if (error) {
    console.error('[Recommend] Canonical game fetch error:', error);
    return [];
  }

  const results = ((data ?? []) as GameRow[]).map(rowToGame);
  console.log(`[Recommend] Canonical games: ${results.length}/${nameList.length} found for [${nameList.slice(0, 5).join(', ')}${nameList.length > 5 ? '...' : ''}]`);
  return results;
}

function collectSearchTags(prefs: QuestionnaireState): string[] {
  const tags = new Set<string>();

  // From user's genre selections
  for (const g of prefs.genres) tags.add(g);

  // From LLM-parsed data
  if (prefs.llmParsed) {
    for (const g of prefs.llmParsed.genres) tags.add(g);
    for (const m of prefs.llmParsed.mechanics) tags.add(m);
  }

  // Expand with BGG aliases so tag search actually finds the right games
  return expandTagsWithAliases([...tags]);
}

/**
 * Fallback 1: Keep player count but drop game type filter.
 * Handles cases like "word game for 7 players" where no word games
 * support that count, but plenty of board/party games do.
 */
async function fetchCandidatesNoType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  prefs: QuestionnaireState,
  popularity: PopularityMode,
) {
  let query = supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('is_expansion', false);

  // Soft quality floor (no hard NOT NULL filter — let unrated games through)
  // Local/curated games have no rating_count — exempt them.
  if (popularity === 'popular') {
    query = query.or('rating_count.gte.10,source.eq.local');
  } else {
    query = query.or('rating_count.gte.1,source.eq.local');
  }

  // Player count only (no type filter)
  if (prefs.playerCount) {
    query = query.lte('min_players', prefs.playerCount.max);
    query = query.gte('max_players', prefs.playerCount.min);
  }

  // In fallback mode, prefer well-known games (popularity) over raw rating
  query = query.order('rating_count', { ascending: false, nullsFirst: false }).limit(RELEVANCE_POOL_SIZE);
  const { data, error } = await query;
  if (error) return [];
  return ((data ?? []) as GameRow[]).map(rowToGame);
}

/**
 * Fallback 2: No preference filters at all, just games with some ratings.
 * Rated games first, unrated games still included.
 */
async function fetchCandidatesFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  popularity: PopularityMode,
) {
  let query = supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('is_expansion', false);

  // Minimal quality floor
  if (popularity === 'popular') {
    query = query.gte('rating_count', 5);
  }

  // In fallback mode, prefer well-known games (popularity) over raw rating
  query = query.order('rating_count', { ascending: false, nullsFirst: false }).limit(RELEVANCE_POOL_SIZE);
  const { data, error } = await query;
  if (error) return [];
  return ((data ?? []) as GameRow[]).map(rowToGame);
}

/**
 * Fallback 3: Nuclear option. ZERO filters. Just grab games by popularity.
 * This should NEVER return 0 unless the DB is literally empty.
 */
async function fetchCandidatesNuclear(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
) {
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .order('rating_count', { ascending: false, nullsFirst: false })
    .limit(RELEVANCE_POOL_SIZE);

  if (error) return [];
  return ((data ?? []) as GameRow[]).map(rowToGame);
}

// ─── SimilarTo Resolution ────────────────────────────────────

/**
 * Looks up games by name from the "similarTo" list and returns:
 * - tags: categories, mechanics, themes (merged into genres for scoring)
 * - games: full Game objects (used for attribute bootstrapping)
 *
 * Attribute bootstrapping: when user says "like Catan," we fetch Catan's
 * full profile and use its attributes (complexity, player count, time) to
 * inform the scoring context. This produces games that *play like* Catan,
 * not just games whose description mentions Catan.
 */
async function resolveSimilarToGames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  similarTo: string[],
): Promise<{ tags: string[]; games: GameRow[] }> {
  const allTags: string[] = [];
  const resolvedGames: GameRow[] = [];

  const lookups = similarTo.slice(0, 5).map(async (name) => {
    // Use full-text search RPC instead of ILIKE (uses GIN index)
    const { data } = await supabase.rpc('search_games_by_name', {
      search_query: name,
      result_limit: 1,
    });

    if (data && data.length > 0) {
      const row = data[0];
      allTags.push(...(row.categories ?? []), ...(row.mechanics ?? []), ...(row.themes ?? []));
      resolvedGames.push(row);
    }
  });

  await Promise.all(lookups);
  return { tags: [...new Set(allTags)], games: resolvedGames };
}

/**
 * Bootstrap preferences from similar games' attributes.
 *
 * When user says "like Catan" but didn't specify complexity/time/playerCount,
 * inherit those constraints from Catan's profile (with slight relaxation).
 * This makes the scoring context match what the user actually wants.
 */
function bootstrapFromSimilarGames(
  body: QuestionnaireState,
  similarGames: GameRow[],
): void {
  if (similarGames.length === 0) return;

  // Use the first similar game as the primary reference
  const ref = similarGames[0];

  // Bootstrap complexity: if user didn't specify, use similar game's +/- 0.75
  if (
    body.complexity.min === 1 && body.complexity.max === 5 && // default (no user preference)
    ref.complexity != null
  ) {
    body.complexity = {
      min: Math.max(1, ref.complexity - 0.75),
      max: Math.min(5, ref.complexity + 0.75),
    };
  }

  // Bootstrap player count: if user used default range, narrow to similar game's range
  if (
    body.playerCount.min === 1 && body.playerCount.max === 10 && // default
    ref.min_players != null && ref.max_players != null
  ) {
    body.playerCount = {
      min: Math.max(1, ref.min_players),
      max: Math.min(10, ref.max_players + 1), // slightly wider
    };
  }

  // Boost similar game's categories and mechanics with 1.5x representation
  // (add them again so they appear more frequently in the genre list,
  // which increases the genre match score for games sharing these tags)
  const boostTags = [
    ...(ref.categories ?? []),
    ...(ref.mechanics ?? []),
  ];
  body.genres = [...body.genres, ...boostTags]; // duplicates boost scoring
}

// ─── Helpers ─────────────────────────────────────────────────

/** Wraps a promise with a timeout — returns fallback if the promise doesn't resolve in time. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function getWeightsForMode(popularity: PopularityMode): ScoringWeights {
  switch (popularity) {
    case 'hidden-gems': return HIDDEN_GEMS_WEIGHTS;
    default: return DEFAULT_WEIGHTS; // 'any' and 'popular' both use default
  }
}
