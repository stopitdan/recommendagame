# Production Readiness Checklist

Tracking all items needed to make boredgame.lol a public, monetized app with Google Ads.

## Tier 1 — Must-Have Before Ads

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Privacy Policy page | ✅ DONE | `/privacy` — covers data collection, third parties, GDPR rights, cookies |
| 2 | Terms of Service page | ✅ DONE | `/terms` — covers accounts, UGC, IP, liability, termination |
| 3 | Cookie Consent banner | ✅ DONE | Custom component, localStorage persistence, Accept/Reject buttons |
| 4 | Google Analytics | ✅ DONE | G-5W6KCSVEJP, respects cookie consent, loads via next/script |
| 5 | robots.txt + sitemap.xml | ✅ DONE | Static generation via Next.js metadata API, 13 pages in sitemap |
| 6 | Security headers (CSP, X-Frame-Options, etc.) | ✅ DONE | CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy via next.config.ts |
| 7 | Rate limiting | ✅ DONE | Upstash sliding window: recommend/parse-text (10/min), browse/search (30/min) |
| 8 | Performance fix | ✅ DONE | Exact count → estimated, 76k dead games migration, expansion filter, ILIKE→RPC, search caching, two-step browse text search, tag query split, composite indexes, 10min cache TTLs |

## Tier 2 — Should-Have for Credibility

| # | Item | Status | Notes |
|---|------|--------|-------|
| 9 | Contact / Help page | ✅ DONE | `/contact` — general inquiries, bug reports, privacy requests |
| 10 | FAQ page | ✅ DONE | `/faq` — 10 questions covering recs, data, accounts, dice, feedback |
| 11 | Error tracking (Sentry) | ⬜ TODO | Can't fix bugs you don't know about in prod |
| 12 | GDPR data export/deletion | ✅ DONE | Export JSON + account deletion in Settings, covers all 9 user tables + storage |
| 13 | Email verification enforcement | ✅ DONE | Supabase confirm email enabled, branded templates for signup/reset/change |
| 14 | Accessibility audit | ✅ DONE | Skip-nav link, aria-labels on all IconButtons, form a11y verified |
| 15 | OpenGraph images / social cards | ✅ DONE | Dynamic OG + Twitter images via Next.js ImageResponse, matches landing page hero |
| 16 | Canonical URLs | ✅ DONE | `alternates.canonical` in root layout metadata |

## Tier 3 — Nice-to-Have for Growth

| # | Item | Status | Notes |
|---|------|--------|-------|
| 17 | About page refresh | ⬜ TODO | Tell the story, build brand identity |
| 18 | JSON-LD structured data | ✅ DONE | WebSite+SearchAction on homepage, VideoGame/BoardGame with ratings on game pages, FAQPage on /faq |
| 19 | User onboarding tour | ✅ DONE | Welcome dialog on first visit to questionnaire, 3-step walkthrough |
| 20 | Share results / social sharing | ✅ DONE | Web Share API (mobile) + menu with Copy Link, Twitter/X, Facebook, Reddit |
| 21 | Newsletter / email capture | ✅ DONE | Email signup on landing page, Supabase table, API route |
| 22 | PWA support | ✅ DONE | Manifest, service worker, PWA icons, add-to-homescreen ready |
| 23 | Feedback widget | ⬜ TODO | Beyond thumbs up/down |
| 24 | Admin dashboard | ⬜ TODO | Monitor rec quality, user stats, errors |
| 25 | API documentation | ⬜ TODO | If opening the API or attracting developers |
