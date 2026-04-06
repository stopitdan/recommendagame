import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/auth/',
          '/settings',
          '/profile',
          '/favorites',
          '/presets',
          '/results',
          '/signup/confirm',
        ],
      },
    ],
    // Game sitemaps are paginated at 50k URLs each — update count if games exceed 100k
    sitemap: [
      'https://boredgame.lol/sitemap.xml',
      'https://boredgame.lol/games/sitemap/0.xml',
      'https://boredgame.lol/games/sitemap/1.xml',
    ],
  };
}
