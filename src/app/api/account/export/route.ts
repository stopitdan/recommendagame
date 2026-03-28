/**
 * GET /api/account/export
 *
 * GDPR data export — returns all user data as a JSON download.
 * Requires authentication.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = user.id;

  // Fetch all user data in parallel
  const [
    profile,
    preferences,
    feedback,
    favorites,
    reviews,
    presets,
    achievements,
    diceSkins,
    diceVotes,
  ] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', userId).single(),
    supabase.from('user_preferences').select('*').eq('id', userId).single(),
    supabase.from('user_game_feedback').select('*, games(name)').eq('user_id', userId),
    supabase.from('user_favorites').select('*, games(name)').eq('user_id', userId),
    supabase.from('user_reviews').select('*, games(name)').eq('user_id', userId),
    supabase.from('user_saved_presets').select('*').eq('user_id', userId),
    supabase.from('user_achievements').select('*').eq('user_id', userId),
    supabase.from('custom_dice_skins').select('*').eq('user_id', userId),
    supabase.from('custom_dice_votes').select('*').eq('user_id', userId),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    profile: profile.data,
    preferences: preferences.data,
    game_feedback: feedback.data ?? [],
    favorites: favorites.data ?? [],
    reviews: reviews.data ?? [],
    saved_presets: presets.data ?? [],
    achievements: achievements.data ?? [],
    custom_dice_skins: diceSkins.data ?? [],
    custom_dice_votes: diceVotes.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="boredgame-data-${userId}.json"`,
    },
  });
}
