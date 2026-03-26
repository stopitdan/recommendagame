/**
 * POST /api/parse-text
 *
 * Parses free-form text into structured game preferences using GPT-4o-mini.
 * Two-tier cache (memory + Supabase) with fuzzy matching avoids redundant calls.
 *
 * Request:  { text: string }
 * Response: { parsed: ParsedPreferences, cached: boolean } or { error: string, parsed: null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { parsePreferencesWithLLM } from '@/lib/llm/parse-preferences';
import { getCachedParse, setCachedParse } from '@/lib/llm/cache';
import type { ParsedPreferences } from '@/lib/llm/types';

export async function POST(request: NextRequest) {
  let body: { text?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', parsed: null }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text || text.length < 3) {
    return NextResponse.json({ error: 'Text too short', parsed: null }, { status: 400 });
  }

  if (text.length > 1000) {
    return NextResponse.json({ error: 'Text too long (max 1000 chars)', parsed: null }, { status: 400 });
  }

  // Check if OPENAI_API_KEY is configured
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'LLM not configured', parsed: null },
      { status: 503 },
    );
  }

  try {
    // Check cache first (exact + fuzzy)
    const cached = await getCachedParse(text);
    if (cached) {
      return NextResponse.json({ parsed: cached, cached: true });
    }

    // Cache miss — call LLM
    const parsed = await parsePreferencesWithLLM(text);

    if (!parsed) {
      return NextResponse.json(
        { error: 'Failed to parse text', parsed: null },
        { status: 502 },
      );
    }

    // Store in cache (both tiers, non-blocking)
    setCachedParse(text, parsed).catch((err) =>
      console.warn('[parse-text] Cache write failed:', err),
    );

    return NextResponse.json({ parsed, cached: false });
  } catch (error) {
    console.error('[parse-text] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', parsed: null },
      { status: 500 },
    );
  }
}
