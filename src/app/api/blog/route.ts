/**
 * GET /api/blog — List published blog posts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { redisCache } from '@/lib/redis';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const cacheKey = `blog:list:${limit}:${offset}`;
  const cached = await redisCache.get<unknown>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const { data, error, count } = await supabase
    .from('blog_posts')
    .select('id, slug, title, description, tags, published_at', { count: 'estimated' })
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = { posts: data ?? [], total: count ?? 0, limit, offset };
  redisCache.set(cacheKey, response, 600); // 10 min cache

  return NextResponse.json(response);
}
