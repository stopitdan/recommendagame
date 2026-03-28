import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
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
    sitemap: 'https://recommendagame.com/sitemap.xml',
  };
}
