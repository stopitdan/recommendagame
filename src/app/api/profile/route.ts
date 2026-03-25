/**
 * GET /api/profile
 *
 * Returns the authenticated user's profile data including:
 * - Basic info (email, display name)
 * - Aggregate stats (favorite count, review count, preset count)
 * - Favorite games (full game data)
 * - Recent reviews (with game names)
 * - Saved presets (names and dates)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rowToGame } from '@/lib/supabase/games';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch all data in parallel
  const [favoritesRes, reviewsRes, presetsRes] = await Promise.all([
    // Favorites: get game IDs then full game data
    supabase
      .from('user_favorites')
      .select('game_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    // Reviews: get with game names
    supabase
      .from('user_reviews')
      .select('id, game_id, rating, review_text, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    // Presets
    supabase
      .from('user_saved_presets')
      .select('id, name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  // Fetch full game data for favorites
  const favoriteGameIds = (favoritesRes.data ?? []).map((f: any) => f.game_id);
  let favorites: any[] = [];
  if (favoriteGameIds.length > 0) {
    const { data: gameRows } = await supabase
      .from('games')
      .select('*')
      .in('id', favoriteGameIds);
    favorites = (gameRows ?? []).map((row: any) => rowToGame(row));
  }

  // Fetch game names for reviews
  const reviewGameIds = (reviewsRes.data ?? []).map((r: any) => r.game_id);
  let gameNameMap = new Map<string, string>();
  if (reviewGameIds.length > 0) {
    const { data: gameNames } = await supabase
      .from('games')
      .select('id, name')
      .in('id', reviewGameIds);
    if (gameNames) {
      gameNameMap = new Map(gameNames.map((g: any) => [g.id, g.name]));
    }
  }

  const recentReviews = (reviewsRes.data ?? []).map((r: any) => ({
    ...r,
    game_name: gameNameMap.get(r.game_id) ?? 'Unknown Game',
  }));

  return NextResponse.json({
    email: user.email ?? '',
    displayName: user.user_metadata?.display_name ?? null,
    favoriteCount: favoriteGameIds.length,
    reviewCount: reviewsRes.data?.length ?? 0,
    presetCount: presetsRes.data?.length ?? 0,
    favorites,
    recentReviews,
    presets: presetsRes.data ?? [],
  });
}
