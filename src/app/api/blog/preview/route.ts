/**
 * GET /api/blog/preview?token=UUID
 *
 * Renders a full preview of a draft blog post using the approval token.
 * Only accessible with a valid token (not publicly discoverable).
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

  if (!token) {
    return new NextResponse('Missing token', { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return new NextResponse('Database not configured', { status: 503 });
  }

  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, description, content, tags, status, created_at')
    .eq('approval_token', token)
    .single();

  if (!post) {
    return new NextResponse('Post not found', { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://boredgame.lol';
  const approveUrl = `${baseUrl}/api/blog/approve?token=${token}`;
  const rejectUrl = `${baseUrl}/api/blog/approve?token=${token}&action=reject`;

  const statusBadge = post.status === 'draft'
    ? '<span style="background:#ff9800;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;">DRAFT</span>'
    : post.status === 'published'
      ? '<span style="background:#4caf50;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;">PUBLISHED</span>'
      : '<span style="background:#f44336;color:white;padding:4px 12px;border-radius:12px;font-size:0.85rem;">REJECTED</span>';

  // Convert basic markdown to HTML (headings, bold, italic, links, paragraphs)
  const contentHtml = post.content
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hup]|<li|<ul)(.+)$/gm, '<p>$1</p>');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preview: ${post.title}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; color: #222; line-height: 1.7; }
  .bar { position: sticky; top: 0; background: #fff; padding: 12px 0; border-bottom: 2px solid #eee; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .bar a { display: inline-block; padding: 8px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; color: white; font-size: 0.9rem; }
  .approve { background: #4caf50; }
  .reject { background: #f44336; }
  h1 { font-size: 1.8rem; margin-bottom: 4px; }
  .meta { color: #888; font-size: 0.9rem; margin-bottom: 24px; }
  h2 { margin-top: 32px; color: #333; }
  a { color: #2196f3; }
  ul { padding-left: 20px; }
  li { margin-bottom: 4px; }
  blockquote { border-left: 3px solid #ddd; padding-left: 16px; color: #666; }
  img { max-width: 420px; width: 100%; height: auto; border-radius: 8px; margin: 20px 0; display: block; box-shadow: 0 2px 12px rgba(0,0,0,0.15); }
</style>
</head><body>
${post.status === 'draft' ? `<div class="bar">${statusBadge}<a href="${approveUrl}" class="approve">Approve</a><a href="${rejectUrl}" class="reject">Reject</a></div>` : `<div class="bar">${statusBadge}</div>`}
<h1>${post.title}</h1>
<div class="meta">${post.description}<br/>Tags: ${(post.tags ?? []).join(', ')} | Created: ${new Date(post.created_at).toLocaleDateString()}</div>
${contentHtml}
</body></html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}
