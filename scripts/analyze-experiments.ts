/**
 * Analyze A/B Experiment Results
 *
 * Reads experiment_logs from Supabase and computes per-group metrics:
 * - Mean latency
 * - Feedback rate (thumbs up / total)
 * - Return rate (same user querying again)
 * - Result diversity
 *
 * Usage: npx tsx scripts/analyze-experiments.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface GroupStats {
  group: string;
  queries: number;
  uniqueUsers: number;
  avgLatencyMs: number;
  thumbsUpRate: number;
  thumbsDownRate: number;
  savedRate: number;
  avgResultCount: number;
}

async function main() {
  console.log('[Experiment Analysis]\n');

  // Fetch experiment logs
  const { data: logs, error } = await supabase
    .from('experiment_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(10000);

  if (error) {
    console.error('Could not fetch experiment_logs:', error.message);
    console.log('\nThe experiment_logs table may not exist yet.');
    console.log('Create it with:');
    console.log('  CREATE TABLE experiment_logs (');
    console.log('    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,');
    console.log('    timestamp timestamptz NOT NULL DEFAULT now(),');
    console.log('    experiment_group text NOT NULL,');
    console.log('    user_id text NOT NULL,');
    console.log('    query_hash text,');
    console.log('    result_count int,');
    console.log('    top_game_ids text[],');
    console.log('    latency_ms int,');
    console.log('    feedback jsonb');
    console.log('  );');
    return;
  }

  if (!logs || logs.length === 0) {
    console.log('No experiment data yet. Start running the A/B test first.');
    return;
  }

  // Group by experiment_group
  const groups = new Map<string, typeof logs>();
  for (const log of logs) {
    const g = log.experiment_group ?? 'unknown';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(log);
  }

  // Compute stats per group
  const stats: GroupStats[] = [];
  for (const [group, groupLogs] of groups) {
    const users = new Set(groupLogs.map((l: any) => l.user_id));
    const totalLatency = groupLogs.reduce((sum: number, l: any) => sum + (l.latency_ms ?? 0), 0);
    const totalResults = groupLogs.reduce((sum: number, l: any) => sum + (l.result_count ?? 0), 0);

    let thumbsUp = 0, thumbsDown = 0, saved = 0, feedbackCount = 0;
    for (const l of groupLogs) {
      if ((l as any).feedback) {
        feedbackCount++;
        thumbsUp += (l as any).feedback.thumbsUp ?? 0;
        thumbsDown += (l as any).feedback.thumbsDown ?? 0;
        saved += (l as any).feedback.saved ?? 0;
      }
    }

    stats.push({
      group,
      queries: groupLogs.length,
      uniqueUsers: users.size,
      avgLatencyMs: groupLogs.length > 0 ? totalLatency / groupLogs.length : 0,
      thumbsUpRate: feedbackCount > 0 ? thumbsUp / feedbackCount : 0,
      thumbsDownRate: feedbackCount > 0 ? thumbsDown / feedbackCount : 0,
      savedRate: feedbackCount > 0 ? saved / feedbackCount : 0,
      avgResultCount: groupLogs.length > 0 ? totalResults / groupLogs.length : 0,
    });
  }

  // Report
  console.log(`Total events: ${logs.length}`);
  console.log(`Date range: ${logs[logs.length - 1]?.timestamp} to ${logs[0]?.timestamp}\n`);

  console.log('─'.repeat(70));
  console.log(`${'Group'.padEnd(15)} ${'Queries'.padEnd(10)} ${'Users'.padEnd(8)} ${'Latency'.padEnd(10)} ${'👍 Rate'.padEnd(10)} ${'👎 Rate'.padEnd(10)} ${'Saved'.padEnd(8)}`);
  console.log('─'.repeat(70));

  for (const s of stats.sort((a, b) => b.queries - a.queries)) {
    console.log(
      `${s.group.padEnd(15)} ${String(s.queries).padEnd(10)} ${String(s.uniqueUsers).padEnd(8)} ${(s.avgLatencyMs.toFixed(0) + 'ms').padEnd(10)} ${(s.thumbsUpRate.toFixed(2)).padEnd(10)} ${(s.thumbsDownRate.toFixed(2)).padEnd(10)} ${s.savedRate.toFixed(2).padEnd(8)}`
    );
  }

  console.log('─'.repeat(70));

  // Statistical significance note
  const minQueriesForSignificance = 100;
  const tooSmall = stats.filter(s => s.queries < minQueriesForSignificance);
  if (tooSmall.length > 0) {
    console.log(`\nNote: groups with < ${minQueriesForSignificance} queries lack statistical significance:`);
    for (const s of tooSmall) {
      console.log(`  ${s.group}: ${s.queries} queries (need ${minQueriesForSignificance}+)`);
    }
  }
}

main().catch(console.error);
