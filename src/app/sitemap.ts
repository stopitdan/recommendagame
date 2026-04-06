import type { MetadataRoute } from 'next';

/**
 * Static sitemap for core pages.
 *
 * Dynamic game pages are handled by /games/sitemap.ts using generateSitemaps()
 * which creates paginated sitemaps (50k URLs each) for all indexed games.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://boredgame.lol';

  const staticPages = [
    { url: '/', changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: '/find-a-game', changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: '/browse', changeFrequency: 'daily' as const, priority: 0.9 },
    { url: '/random', changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: '/dice-gallery', changeFrequency: 'daily' as const, priority: 0.6 },
    { url: '/dice-creator', changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: '/leaderboard', changeFrequency: 'daily' as const, priority: 0.6 },
    { url: '/about', changeFrequency: 'monthly' as const, priority: 0.4 },
    { url: '/future-roadmap', changeFrequency: 'weekly' as const, priority: 0.3 },
    { url: '/login', changeFrequency: 'yearly' as const, priority: 0.2 },
    { url: '/signup', changeFrequency: 'yearly' as const, priority: 0.2 },
    { url: '/blog', changeFrequency: 'daily' as const, priority: 0.8 },
    { url: '/compare', changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: '/chat', changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: '/map', changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: '/faq', changeFrequency: 'monthly' as const, priority: 0.4 },
    { url: '/contact', changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: '/privacy', changeFrequency: 'yearly' as const, priority: 0.1 },
    { url: '/terms', changeFrequency: 'yearly' as const, priority: 0.1 },
  ];

  return staticPages.map((page) => ({
    url: `${base}${page.url}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
