import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking — allow framing only by same origin
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Block MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Control referrer info sent with requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Opt into DNS prefetching for external resources
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Restrict browser features the site can use
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Content Security Policy — permissive enough for MUI, Google Analytics/Ads, and Supabase
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: self + inline (MUI/Next.js needs it) + eval (MUI styled-components) + Google tags
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://adservice.google.com",
      // Styles: self + inline (MUI injects styles)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Images: self + data URIs (inline icons) + Supabase storage + game cover images
      "img-src 'self' data: blob: https://*.supabase.co https://images.igdb.com https://media.rawg.io https://cf.geekdo-images.com https://www.google-analytics.com https://pagead2.googlesyndication.com",
      // Fonts: self + Google Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Connect: self + Supabase + analytics + OpenAI + Upstash
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://analytics.google.com https://pagead2.googlesyndication.com https://api.openai.com https://*.upstash.io",
      // Frames: Google Ads may use iframes
      "frame-src https://pagead2.googlesyndication.com https://www.google.com",
      // Object/base restrictions
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  // Strict Transport Security — enforce HTTPS for 1 year
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  headers: async () => [
    {
      // Apply security headers to all routes
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
