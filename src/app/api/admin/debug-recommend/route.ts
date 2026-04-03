/**
 * POST /api/admin/debug-recommend
 *
 * Admin-only endpoint that runs the recommendation engine with full debug output.
 * Returns LLM-parsed preferences, all scoring breakdowns, candidate sources, etc.
 * Restricted to danjwiegand@gmail.com.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parsePreferencesWithLLM } from '@/lib/llm/parse-preferences';

const ADMIN_EMAIL = 'danjwiegand@gmail.com';

export async function POST(request: NextRequest) {
  // Auth check — admin only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { freeText } = body;

  if (!freeText || typeof freeText !== 'string') {
    return NextResponse.json({ error: 'freeText required' }, { status: 400 });
  }

  // Step 1: Parse free text with LLM
  const llmParsed = await parsePreferencesWithLLM(freeText);

  // Step 2: Run full recommendation through the normal endpoint
  // We call it internally with _nocache and include the parsed data
  const recBody = {
    ...body,
    llmParsed,
    freeText,
    gameTypes: body.gameTypes ?? [],
    playerCount: body.playerCount ?? { min: 1, max: 10 },
    timePresets: body.timePresets ?? [],
    complexity: body.complexity ?? { min: 1, max: 5 },
    genres: body.genres ?? [],
    moods: body.moods ?? [],
    limit: 50,
    _nocache: true,
  };

  const recResponse = await fetch(new URL('/api/recommend', request.url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify(recBody),
  });

  const recData = await recResponse.json();

  return NextResponse.json({
    llmParsed,
    requestBody: recBody,
    results: recData.results ?? [],
    totalCandidates: recData.totalCandidates,
    engine: recData.engine,
    latencyMs: recData.latencyMs,
  });
}
