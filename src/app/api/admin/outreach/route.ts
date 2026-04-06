/**
 * GET  /api/admin/outreach       — List all outreach tasks
 * POST /api/admin/outreach       — Create a new task
 * Admin-only (danjwiegand@gmail.com).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createTypedClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'danjwiegand@gmail.com';

/** Untyped client for tables not yet in the generated types. */
function createDbClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function assertAdmin() {
  const supabase = await createTypedClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return createDbClient();
}

export async function GET() {
  const supabase = await assertAdmin();
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabase
    .from('outreach_tasks')
    .select('*')
    .order('category')
    .order('priority');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data });
}

export async function POST(request: NextRequest) {
  const supabase = await assertAdmin();
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { category, platform, url, post_title, post_body, notes, priority, day_target } = body;

  if (!category || !platform || !url) {
    return NextResponse.json({ error: 'category, platform, and url are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('outreach_tasks')
    .insert({
      category,
      platform,
      url,
      post_title: post_title ?? null,
      post_body: post_body ?? null,
      notes: notes ?? null,
      priority: priority ?? 50,
      day_target: day_target ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data }, { status: 201 });
}
