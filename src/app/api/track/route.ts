/**
 * Implicit Signal Tracking API
 *
 * POST /api/track — Record user behavior signals (clicks, dwell time, scroll depth, searches)
 *   Body: { events: Array<{ type, gameId?, payload? }> }
 *
 * Accepts batched events to minimize network requests. Each event is inserted
 * individually into user_implicit_signals for granular analysis.
 *
 * Anonymous users get a session ID from the client; authenticated users use their user_id.
 * Both are tracked, but only authenticated signals feed into collaborative filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_EVENT_TYPES = new Set([
  'result_click',    // User clicked a game from results
  'dwell',           // Time spent on a game detail page
  'scroll_depth',    // How far they scrolled on a page
  'search',          // A recommendation search was performed
  'share',           // User shared a game
  'favorite_toggle', // User toggled a favorite
  'blog_view',       // User viewed a blog post
  'page_view',       // General page view with context
]);

interface TrackEvent {
  type: string;
  gameId?: string;
  payload?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let body: { events?: TrackEvent[]; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { events, sessionId } = body;

  if (!events || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'events array is required' }, { status: 400 });
  }

  // Cap batch size to prevent abuse
  if (events.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 events per batch' }, { status: 400 });
  }

  const sid = sessionId ?? 'anonymous';

  const rows = events
    .filter((e) => VALID_EVENT_TYPES.has(e.type))
    .map((e) => ({
      user_id: user?.id ?? null,
      session_id: sid,
      event_type: e.type,
      game_id: e.gameId ?? null,
      payload: e.payload ?? {},
    }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, tracked: 0 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_implicit_signals')
    .insert(rows);

  if (error) {
    console.error('[Track] Insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tracked: rows.length });
}
