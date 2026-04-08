import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import BlogPostView from './BlogPostView';

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createDbClient();

  if (!supabase) {
    return { title: 'Blog Post' };
  }

  const { data } = await supabase
    .from('blog_posts')
    .select('title, description, tags, published_at')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .single();

  if (!data) {
    return { title: 'Post Not Found' };
  }

  const description = data.description
    || `Read "${data.title}" on the boredgame.lol blog.`;

  return {
    title: data.title,
    description,
    keywords: [...(data.tags ?? []), 'board games', 'game recommendations', 'boredgame.lol'],
    openGraph: {
      type: 'article',
      title: data.title,
      description,
      url: `https://boredgame.lol/blog/${slug}`,
      siteName: 'boredgame.lol',
      publishedTime: data.published_at,
    },
    twitter: {
      card: 'summary_large_image',
      title: data.title,
      description,
    },
    alternates: {
      canonical: `https://boredgame.lol/blog/${slug}`,
    },
  };
}

export default function BlogPostPage() {
  return <BlogPostView />;
}
