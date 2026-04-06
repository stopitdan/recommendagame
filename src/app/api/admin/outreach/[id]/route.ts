/**
 * PATCH  /api/admin/outreach/[id] — Update a single outreach task
 * DELETE /api/admin/outreach/[id] — Delete a single outreach task
 * Admin-only.
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

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await assertAdmin();
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  // Only allow updating specific fields
  const allowed = [
    'status', 'result_notes', 'posted_url', 'post_title', 'post_body', 'notes',
    'priority', 'day_target', 'category', 'platform', 'url',
    'cost_type', 'cost_amount', 'can_post_immediately', 'maintenance_level',
    'link_type', 'approval_process', 'estimated_reach', 'time_to_live',
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('outreach_tasks')
    .update(updates)
    .eq('id', Number(id))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const supabase = await assertAdmin();
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const { error } = await supabase
    .from('outreach_tasks')
    .delete()
    .eq('id', Number(id));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
