/**
 * GET /api/blog/:slug — Get a single blog post by slug
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { redisCache } from '@/lib/redis';
import { shouldSkipCache, jsonWithCacheHeader } from '@/lib/cache-bypass';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params;
  const skipCache = shouldSkipCache(request);

  const cacheKey = `blog:post:${slug}`;
  if (!skipCache) {
    const cached = await redisCache.get<unknown>(cacheKey);
    if (cached) return jsonWithCacheHeader(cached, true);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  redisCache.set(cacheKey, { post: data }, 1800); // 30 min cache
  return NextResponse.json({ post: data });
}
