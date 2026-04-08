/**
 * GET /api/reports/daily — Aggregate yesterday's site stats and email a daily report
 *
 * Called by Vercel Cron Job (daily at 7 AM UTC).
 * Protected by CRON_SECRET. Queries implicit signals, feedback, blog views,
 * and user signups from the past 24 hours. Aggregates into daily_site_stats
 * and sends a formatted email digest via Resend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];
  const startOfDay = `${dateStr}T00:00:00Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  // Gather all stats in parallel
  const [
    signalsRes,
    feedbackRes,
    usersRes,
    blogViewsRes,
    totalGamesRes,
    totalUsersRes,
    blogPostsRes,
  ] = await Promise.all([
    // Implicit signals from yesterday
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('user_implicit_signals')
      .select('event_type, game_id, payload')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),

    // Explicit feedback from yesterday
    supabase
      .from('user_game_feedback')
      .select('rating')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),

    // New signups from yesterday
    supabase
      .from('user_profiles')
      .select('id')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),

    // Blog post views (from implicit signals)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('user_implicit_signals')
      .select('payload')
      .eq('event_type', 'blog_view')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay),

    // Total games in DB
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true }),

    // Total registered users
    supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true }),

    // Published blog posts
    supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
  ]);

  const signals = signalsRes.data ?? [];
  const feedback = feedbackRes.data ?? [];
  const newUsers = usersRes.data ?? [];
  const blogViews = blogViewsRes.data ?? [];

  // Aggregate signal types
  const searches = signals.filter((s: { event_type: string }) => s.event_type === 'search');
  const resultClicks = signals.filter((s: { event_type: string }) => s.event_type === 'result_click');
  const dwells = signals.filter((s: { event_type: string }) => s.event_type === 'dwell');
  const scrolls = signals.filter((s: { event_type: string }) => s.event_type === 'scroll_depth');

  // Compute averages
  const avgDwellMs = dwells.length > 0
    ? Math.round(dwells.reduce((sum: number, d: { payload: { dwell_ms?: number } }) => sum + (d.payload?.dwell_ms ?? 0), 0) / dwells.length)
    : 0;
  const avgScrollPct = scrolls.length > 0
    ? Math.round(scrolls.reduce((sum: number, s: { payload: { scroll_pct?: number } }) => sum + (s.payload?.scroll_pct ?? 0), 0) / scrolls.length)
    : 0;

  // Top searched terms
  const termCounts: Record<string, number> = {};
  for (const s of searches) {
    const query = (s as { payload?: { query?: string } }).payload?.query;
    if (query) termCounts[query] = (termCounts[query] ?? 0) + 1;
  }
  const topSearched = Object.entries(termCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term, count }));

  // Top clicked games
  const clickCounts: Record<string, number> = {};
  for (const c of resultClicks) {
    const gid = (c as { game_id?: string }).game_id;
    if (gid) clickCounts[gid] = (clickCounts[gid] ?? 0) + 1;
  }
  const topClicked = Object.entries(clickCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([gameId, count]) => ({ gameId, count }));

  // Resolve game names for top clicked
  const gameNames: Record<string, string> = {};
  if (topClicked.length > 0) {
    const { data: gameRows } = await supabase
      .from('games')
      .select('id, name')
      .in('id', topClicked.map((g) => g.gameId));
    for (const row of (gameRows ?? []) as Array<{ id: string; name: string }>) {
      gameNames[row.id] = row.name;
    }
  }

  // Unique users (from signals with user_id)
  const uniqueUserIds = new Set(
    signals
      .filter((s: { user_id?: string }) => s.user_id)
      .map((s: { user_id: string }) => s.user_id)
  );

  const thumbsUp = feedback.filter((f: { rating: number }) => f.rating === 1).length;
  const thumbsDown = feedback.filter((f: { rating: number }) => f.rating === -1).length;

  const stats = {
    date: dateStr,
    total_searches: searches.length,
    unique_users: uniqueUserIds.size,
    result_clicks: resultClicks.length,
    avg_dwell_ms: avgDwellMs,
    avg_scroll_pct: avgScrollPct,
    top_searched_terms: topSearched,
    top_clicked_games: topClicked,
    new_signups: newUsers.length,
    feedback_given: feedback.length,
    blog_views: blogViews.length,
  };

  // Save to daily_site_stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('daily_site_stats')
    .upsert(stats, { onConflict: 'date' });

  // Build and send email
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ stats, email: 'skipped (no RESEND_API_KEY)' });
  }

  const ctr = searches.length > 0
    ? `${((resultClicks.length / searches.length) * 100).toFixed(1)}%`
    : 'N/A';

  const topSearchedList = topSearched.length > 0
    ? topSearched.map((t, i) => `  ${i + 1}. "${t.term}" (${t.count}x)`).join('\n')
    : '  (no searches recorded)';

  const topClickedList = topClicked.length > 0
    ? topClicked.map((g, i) => `  ${i + 1}. ${gameNames[g.gameId] ?? g.gameId} (${g.count} clicks)`).join('\n')
    : '  (no clicks recorded)';

  const emailText = `
boredgame.lol Daily Report -- ${dateStr}
${'='.repeat(50)}

TRAFFIC
  Searches: ${searches.length}
  Unique users (tracked): ${uniqueUserIds.size}
  Result clicks: ${resultClicks.length}
  Click-through rate: ${ctr}

ENGAGEMENT
  Avg dwell time: ${avgDwellMs > 0 ? `${(avgDwellMs / 1000).toFixed(1)}s` : 'N/A'}
  Avg scroll depth: ${avgScrollPct > 0 ? `${avgScrollPct}%` : 'N/A'}
  Blog views: ${blogViews.length}

FEEDBACK
  Thumbs up: ${thumbsUp}
  Thumbs down: ${thumbsDown}
  Total: ${feedback.length}

GROWTH
  New signups: ${newUsers.length}
  Total users: ${totalUsersRes.count ?? '?'}
  Total games: ${totalGamesRes.count ?? '?'}
  Published posts: ${blogPostsRes.count ?? '?'}

TOP SEARCHES
${topSearchedList}

TOP CLICKED GAMES
${topClickedList}

---
Sent automatically from boredgame.lol
`.trim();

  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from: 'boredgame.lol Reports <noreply@boredgame.lol>',
      to: 'contact@boredgame.lol',
      subject: `Daily Report: ${dateStr} | ${searches.length} searches, ${newUsers.length} signups`,
      text: emailText,
    });
  } catch (err) {
    console.error('[DailyReport] Email error:', err);
    return NextResponse.json({ stats, email: 'failed' }, { status: 500 });
  }

  return NextResponse.json({ stats, email: 'sent' });
}
