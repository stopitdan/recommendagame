/**
 * POST /api/newsletter — Subscribe to the newsletter
 *
 * Accepts { email } and stores it in the newsletter_subscribers table.
 * No auth required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = body.email?.trim()?.toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const supabase = createClient(url, key);

  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert({ email }, { onConflict: 'email' });

  if (error) {
    console.error('[Newsletter] Error:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
