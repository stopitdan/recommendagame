/**
 * POST /api/sync
 *
 * Triggers a game sync from external APIs into Supabase.
 * Protected by a simple secret token to prevent unauthorized syncs.
 *
 * Usage:
 *   curl -X POST http://localhost:3001/api/sync \
 *     -H "Authorization: Bearer YOUR_SYNC_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"sources": ["bgg", "rawg"], "limit": 50}'
 *
 * Body params:
 *   sources — which adapters to sync from (default: all)
 *   limit   — max games per adapter (default: 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { bggAdapter } from '@/lib/adapters/bgg';
import { rawgAdapter } from '@/lib/adapters/rawg';
import { localAdapter } from '@/lib/adapters/local';
import { syncPopularFromAll, type SyncResult } from '@/lib/sync/game-sync';
import type { GameAdapter, GameSource } from '@/types/game';

/** Registry of all available adapters, keyed by source */
const adapters: Partial<Record<GameSource, GameAdapter>> = {
  bgg: bggAdapter,
  rawg: rawgAdapter,
  local: localAdapter,
  // Future: igdb
};

/** Available adapter sources (only ones that are actually implemented) */
const availableSources = Object.keys(adapters) as GameSource[];

export async function POST(request: NextRequest) {
  // Auth check — require a sync secret to prevent abuse
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${syncSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Parse request body
  let sources: GameSource[] = availableSources;
  let limit = 50;

  try {
    const body = await request.json();
    if (body.sources && Array.isArray(body.sources)) {
      sources = body.sources.filter(
        (s: string): s is GameSource => availableSources.includes(s as GameSource),
      );
    }
    if (body.limit && typeof body.limit === 'number') {
      limit = Math.min(body.limit, 200); // Cap at 200 to be safe
    }
  } catch {
    // Empty body is fine — use defaults
  }

  if (sources.length === 0) {
    return NextResponse.json(
      { error: 'No valid sources specified', available: availableSources },
      { status: 400 },
    );
  }

  // Run the sync
  const selectedAdapters = sources
    .map((s) => adapters[s])
    .filter((a): a is GameAdapter => a !== undefined);

  console.log(`[API /sync] Starting sync for sources: ${sources.join(', ')}, limit: ${limit}`);

  const results: SyncResult[] = await syncPopularFromAll(selectedAdapters, limit);

  const summary = {
    sources: results.map((r) => r.source),
    totalAttempted: results.reduce((sum, r) => sum + r.attempted, 0),
    totalSucceeded: results.reduce((sum, r) => sum + r.succeeded, 0),
    totalFailed: results.reduce((sum, r) => sum + r.failed, 0),
    details: results,
  };

  console.log(
    `[API /sync] Complete: ${summary.totalSucceeded}/${summary.totalAttempted} succeeded`,
  );

  return NextResponse.json(summary);
}
