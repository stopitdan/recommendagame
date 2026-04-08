/**
 * GET /api/reports/weekly — Send a weekly summary comparing this week to last
 *
 * Called by Vercel Cron Job (every Monday at 8 AM UTC).
 * Protected by CRON_SECRET. Reads daily_site_stats for the past 14 days,
 * compares this week vs last week, and emails a trend report.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

interface DayStats {
  date: string;
  total_searches: number;
  unique_users: number;
  result_clicks: number;
  avg_dwell_ms: number;
  avg_scroll_pct: number;
  new_signups: number;
  feedback_given: number;
  blog_views: number;
  top_searched_terms: Array<{ term: string; count: number }>;
  top_clicked_games: Array<{ gameId: string; count: number }>;
}

function sumField(rows: DayStats[], field: keyof DayStats): number {
  return rows.reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
}

function avgField(rows: DayStats[], field: keyof DayStats): number {
  if (rows.length === 0) return 0;
  return Math.round(sumField(rows, field) / rows.length);
}

function trend(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+inf' : '0';
  const pct = ((current - previous) / previous * 100).toFixed(0);
  return Number(pct) >= 0 ? `+${pct}%` : `${pct}%`;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();

  // This week = last 7 days, last week = 8-14 days ago
  const thisWeekEnd = new Date(now);
  thisWeekEnd.setDate(thisWeekEnd.getDate() - 1);
  const thisWeekStart = new Date(thisWeekEnd);
  thisWeekStart.setDate(thisWeekStart.getDate() - 6);

  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekStart.getDate() - 6);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allStats } = await (supabase as any)
    .from('daily_site_stats')
    .select('*')
    .gte('date', fmt(lastWeekStart))
    .lte('date', fmt(thisWeekEnd))
    .order('date', { ascending: true });

  const rows = (allStats ?? []) as DayStats[];
  const thisWeek = rows.filter((r) => r.date >= fmt(thisWeekStart));
  const lastWeek = rows.filter((r) => r.date < fmt(thisWeekStart));

  const metrics = {
    searches: { this: sumField(thisWeek, 'total_searches'), last: sumField(lastWeek, 'total_searches') },
    users: { this: sumField(thisWeek, 'unique_users'), last: sumField(lastWeek, 'unique_users') },
    clicks: { this: sumField(thisWeek, 'result_clicks'), last: sumField(lastWeek, 'result_clicks') },
    signups: { this: sumField(thisWeek, 'new_signups'), last: sumField(lastWeek, 'new_signups') },
    feedback: { this: sumField(thisWeek, 'feedback_given'), last: sumField(lastWeek, 'feedback_given') },
    blogViews: { this: sumField(thisWeek, 'blog_views'), last: sumField(lastWeek, 'blog_views') },
    avgDwell: { this: avgField(thisWeek, 'avg_dwell_ms'), last: avgField(lastWeek, 'avg_dwell_ms') },
    avgScroll: { this: avgField(thisWeek, 'avg_scroll_pct'), last: avgField(lastWeek, 'avg_scroll_pct') },
  };

  // Aggregate top searches across the week
  const weekTerms: Record<string, number> = {};
  for (const day of thisWeek) {
    for (const t of day.top_searched_terms ?? []) {
      weekTerms[t.term] = (weekTerms[t.term] ?? 0) + t.count;
    }
  }
  const topWeekSearches = Object.entries(weekTerms)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  // Top clicked games across the week
  const weekClicks: Record<string, number> = {};
  for (const day of thisWeek) {
    for (const g of day.top_clicked_games ?? []) {
      weekClicks[g.gameId] = (weekClicks[g.gameId] ?? 0) + g.count;
    }
  }
  const topWeekClicked = Object.entries(weekClicks)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  // Resolve game names
  const gameNames: Record<string, string> = {};
  if (topWeekClicked.length > 0) {
    const { data: gameRows } = await supabase
      .from('games')
      .select('id, name')
      .in('id', topWeekClicked.map(([id]) => id));
    for (const row of (gameRows ?? []) as Array<{ id: string; name: string }>) {
      gameNames[row.id] = row.name;
    }
  }

  // Get totals
  const [totalGamesRes, totalUsersRes, totalPostsRes] = await Promise.all([
    supabase.from('games').select('id', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
    supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
  ]);

  const line = (label: string, curr: number, prev: number, suffix = '') =>
    `  ${label}: ${curr}${suffix} (${trend(curr, prev)} vs last week)`;

  const topSearchList = topWeekSearches.length > 0
    ? topWeekSearches.map(([term, count], i) => `  ${i + 1}. "${term}" (${count}x)`).join('\n')
    : '  (no searches)';

  const topClickList = topWeekClicked.length > 0
    ? topWeekClicked.map(([id, count], i) => `  ${i + 1}. ${gameNames[id] ?? id} (${count} clicks)`).join('\n')
    : '  (no clicks)';

  const emailText = `
boredgame.lol Weekly Report
${fmt(thisWeekStart)} to ${fmt(thisWeekEnd)}
${'='.repeat(50)}

TRAFFIC
${line('Searches', metrics.searches.this, metrics.searches.last)}
${line('Unique users', metrics.users.this, metrics.users.last)}
${line('Result clicks', metrics.clicks.this, metrics.clicks.last)}

ENGAGEMENT
${line('Avg dwell time', metrics.avgDwell.this, metrics.avgDwell.last, 'ms')}
${line('Avg scroll depth', metrics.avgScroll.this, metrics.avgScroll.last, '%')}
${line('Blog views', metrics.blogViews.this, metrics.blogViews.last)}

GROWTH
${line('New signups', metrics.signups.this, metrics.signups.last)}
${line('Feedback given', metrics.feedback.this, metrics.feedback.last)}
  Total users: ${totalUsersRes.count ?? '?'}
  Total games: ${totalGamesRes.count ?? '?'}
  Published posts: ${totalPostsRes.count ?? '?'}

TOP SEARCHES THIS WEEK
${topSearchList}

TOP CLICKED GAMES THIS WEEK
${topClickList}

DAILY BREAKDOWN
${thisWeek.map((d) => `  ${d.date}: ${d.total_searches} searches, ${d.result_clicks} clicks, ${d.new_signups} signups`).join('\n') || '  (no data)'}

---
Sent automatically from boredgame.lol
`.trim();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ metrics, email: 'skipped' });
  }

  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from: 'boredgame.lol Reports <noreply@boredgame.lol>',
      to: 'contact@boredgame.lol',
      subject: `Weekly Report: ${metrics.searches.this} searches (${trend(metrics.searches.this, metrics.searches.last)}), ${metrics.signups.this} signups`,
      text: emailText,
    });
  } catch (err) {
    console.error('[WeeklyReport] Email error:', err);
    return NextResponse.json({ metrics, email: 'failed' }, { status: 500 });
  }

  return NextResponse.json({ metrics, email: 'sent' });
}
