import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://boredgame.lol';
const GAMES_PER_SITEMAP = 50_000;

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Generate paginated sitemap indices.
 * Google's limit is 50,000 URLs per sitemap file.
 */
export async function generateSitemaps() {
  const supabase = createDbClient();
  if (!supabase) return [{ id: 0 }];

  const { count } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true });

  const total = count ?? 0;
  const numSitemaps = Math.max(1, Math.ceil(total / GAMES_PER_SITEMAP));

  return Array.from({ length: numSitemaps }, (_, i) => ({ id: i }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const supabase = createDbClient();
  if (!supabase) return [];

  const offset = id * GAMES_PER_SITEMAP;

  const { data } = await supabase
    .from('games')
    .select('id')
    .order('id', { ascending: true })
    .range(offset, offset + GAMES_PER_SITEMAP - 1);

  if (!data) return [];

  return data.map((row) => ({
    url: `${BASE_URL}/games/${row.id}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));
}
