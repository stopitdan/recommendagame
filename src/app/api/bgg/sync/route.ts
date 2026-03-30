/**
 * POST /api/bgg/sync — Sync a user's BGG collection
 *
 * Takes { username } and imports their BoardGameGeek collection,
 * ratings, and play data into our database. Converts BGG ratings
 * to internal feedback signals for better recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncBggCollection } from '@/lib/bgg/sync';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const username = body.username?.trim()?.replace(/^@/, '');

  if (!username || username.length < 2 || username.length > 50) {
    return NextResponse.json({ error: 'Invalid BGG username' }, { status: 400 });
  }

  try {
    const result = await syncBggCollection(user.id, username);

    if (!result) {
      return NextResponse.json(
        { error: 'Could not fetch BGG collection. Check the username and try again.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
      message: `Imported ${result.total} games (${result.matched} matched in our database, ${result.feedbackCreated} ratings synced)`,
    });
  } catch (err) {
    console.error('[BGG Sync] Error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
