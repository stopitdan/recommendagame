/**
 * POST /api/share — Create a shareable recommendation link
 * GET /api/share?id=xxx — Retrieve shared recommendations
 *
 * Stores questionnaire preferences as a short-lived shareable payload.
 * Uses a simple hash-based ID (no auth required to share).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Generate a short random ID */
function generateShareId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { preferences, results } = body;

  if (!preferences) {
    return NextResponse.json({ error: 'Missing preferences' }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    // Fallback: encode preferences in the URL directly
    const encoded = Buffer.from(JSON.stringify(preferences)).toString('base64url');
    return NextResponse.json({ shareId: null, encoded });
  }

  // Store in a simple key-value style using a new table or just return encoded
  // For now, use URL-encoded approach (no extra DB table needed)
  const shareData = {
    preferences,
    topGameIds: (results ?? []).slice(0, 5).map((g: any) => g.id),
    createdAt: new Date().toISOString(),
  };

  const encoded = Buffer.from(JSON.stringify(shareData)).toString('base64url');
  const shareId = generateShareId();

  return NextResponse.json({
    shareId,
    shareUrl: `/results?shared=${encoded}`,
  });
}
