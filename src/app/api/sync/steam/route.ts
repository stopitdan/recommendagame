/**
 * POST /api/sync/steam
 *
 * Import a user's Steam library into their collection.
 * Body: { steamInput: string } -- Steam64 ID, vanity URL, or full profile URL.
 *
 * Requires STEAM_API_KEY env var (free from steamcommunity.com/dev/apikey).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncSteamLibrary } from '@/lib/steam/sync';

export async function POST(request: NextRequest) {
  if (!process.env.STEAM_API_KEY) {
    return NextResponse.json(
      { error: 'Steam integration not configured. Add STEAM_API_KEY to environment.' },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: { steamInput?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { steamInput } = body;
  if (!steamInput?.trim()) {
    return NextResponse.json({ error: 'steamInput is required' }, { status: 400 });
  }

  try {
    const result = await syncSteamLibrary(user.id, steamInput.trim());

    if (!result) {
      return NextResponse.json(
        { error: 'Could not fetch Steam library. Make sure the profile is public and the ID/URL is correct.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: `Imported ${result.imported} of ${result.total} Steam games (${result.matched} matched in our database)`,
      ...result,
    });
  } catch (err) {
    console.error('[Steam Sync] Error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
