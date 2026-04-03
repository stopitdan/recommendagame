/**
 * GET /api/blog/approve?token=UUID&action=approve|reject
 *
 * One-click approval/rejection from the email draft notification.
 * Validates the approval_token, updates the post status, and
 * sets published_at for approved posts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const action = request.nextUrl.searchParams.get('action') ?? 'approve';

  if (!token) {
    return new NextResponse(page('Missing token', 'No approval token provided.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return new NextResponse(page('Error', 'Database not configured.'), {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Find the draft post by approval token
  const { data: post, error: fetchError } = await supabase
    .from('blog_posts')
    .select('id, title, status, slug')
    .eq('approval_token', token)
    .single();

  if (fetchError || !post) {
    return new NextResponse(page('Not Found', 'No post found for this token. It may have already been processed.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (post.status === 'published') {
    return new NextResponse(page('Already Published', `"${post.title}" is already live.`), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (post.status === 'rejected') {
    return new NextResponse(page('Already Rejected', `"${post.title}" was previously rejected.`), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (action === 'reject') {
    await supabase
      .from('blog_posts')
      .update({ status: 'rejected' })
      .eq('id', post.id);

    return new NextResponse(
      page('Rejected', `"${post.title}" has been rejected and will not be published.`),
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  // Approve: set published_at and status
  const { error: updateError } = await supabase
    .from('blog_posts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', post.id);

  if (updateError) {
    return new NextResponse(page('Error', 'Failed to publish. Try again or check the database.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://boredgame.lol';

  return new NextResponse(
    page('Published!', `"${post.title}" is now live. <a href="${siteUrl}/blog/${post.slug}">View post</a>`),
    { headers: { 'Content-Type': 'text/html' } },
  );
}

/** Simple HTML response page */
function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} - boredgame.lol</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;text-align:center;color:#222;}
h1{font-size:1.8rem;}p{font-size:1.1rem;line-height:1.6;color:#555;}a{color:#2196f3;}</style>
</head><body><h1>${title}</h1><p>${body}</p></body></html>`;
}
