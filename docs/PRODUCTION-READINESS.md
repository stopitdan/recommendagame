# Production Readiness Checklist

Tracking all items needed to make boredgame.lol a public, monetized app with Google Ads.

## Tier 1 — Must-Have Before Ads

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Privacy Policy page | ✅ DONE | `/privacy` — covers data collection, third parties, GDPR rights, cookies |
| 2 | Terms of Service page | ✅ DONE | `/terms` — covers accounts, UGC, IP, liability, termination |
| 3 | Cookie Consent banner | ✅ DONE | Custom component, localStorage persistence, Accept/Reject buttons |
| 4 | Google Analytics | ✅ DONE | G-5W6KCSVEJP, respects cookie consent, loads via next/script |
| 5 | robots.txt + sitemap.xml | ✅ DONE | Static generation via Next.js metadata API, 17+ pages in sitemap |
| 6 | Security headers (CSP, X-Frame-Options, etc.) | ✅ DONE | CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy via next.config.ts |
| 7 | Rate limiting | ✅ DONE | Upstash sliding window: recommend/parse-text (30/min), browse/search (60/min) |
| 8 | Performance fix | ✅ DONE | Exact count → estimated, 76k dead games migration, expansion filter, ILIKE→RPC, search caching, two-step browse text search, tag query split, composite indexes, 10min cache TTLs |

## Tier 2 — Should-Have for Credibility

| # | Item | Status | Notes |
|---|------|--------|-------|
| 9 | Contact / Help page | ✅ DONE | `/contact` — general inquiries, bug reports, privacy requests |
| 10 | FAQ page | ✅ DONE | `/faq` — 10 questions covering recs, data, accounts, dice, feedback |
| 11 | Error tracking (Sentry) | ⬜ SKIPPED | Can add later when traffic warrants it |
| 12 | GDPR data export/deletion | ✅ DONE | Export JSON + account deletion in Settings, covers all 9 user tables + storage |
| 13 | Email verification enforcement | ✅ DONE | Supabase confirm email enabled, branded templates for signup/reset/change |
| 14 | Accessibility audit | ✅ DONE | Skip-nav link, aria-labels on all IconButtons, form a11y verified |
| 15 | OpenGraph images / social cards | ✅ DONE | Dynamic OG + Twitter images via Next.js ImageResponse, matches landing page hero |
| 16 | Canonical URLs | ✅ DONE | `alternates.canonical` in root layout metadata |

## Tier 3 — Nice-to-Have for Growth

| # | Item | Status | Notes |
|---|------|--------|-------|
| 17 | About page refresh | ✅ DONE | Story-driven copy, problem/solution framing, CTA at bottom |
| 18 | JSON-LD structured data | ✅ DONE | WebSite+SearchAction on homepage, VideoGame/BoardGame with ratings on game pages, FAQPage on /faq, BlogPosting on blog posts |
| 19 | User onboarding tour | ✅ DONE | Welcome dialog on first visit to questionnaire, 3-step walkthrough |
| 20 | Share results / social sharing | ✅ DONE | Web Share API (mobile) + menu with Copy Link, Twitter/X, Facebook, Reddit |
| 21 | Newsletter / email capture | ✅ DONE | Email signup on landing page, Supabase table (migration 016), API route |
| 22 | PWA support | ✅ DONE | Manifest, service worker, PWA icons (dice design), add-to-homescreen ready |
| 23 | Feedback widget | ⬜ TODO | Beyond thumbs up/down |
| 24 | Admin dashboard | ⬜ TODO | Monitor rec quality, user stats, errors |
| 25 | API documentation | ⬜ TODO | If opening the API or attracting developers |

## Session 3 Features (March 27-28, 2026)

| Feature | Status | Notes |
|---------|--------|-------|
| Rebrand to boredgame.lol | ✅ DONE | Full rebrand across 50+ files, domain, metadata, legal pages |
| Emoji → Lucide icons | ✅ DONE | 100+ emoji instances replaced across 25 files (kept achievements, dice creator, color presets) |
| Amazon affiliate links | ✅ DONE | "Buy" chip on game cards, "Where to Buy" section on detail pages (Amazon + Steam/Target) |
| Daily Game Pick | ✅ DONE | Deterministic high-rated game of the day on homepage, Redis cached |
| Search autocomplete | ✅ DONE | Debounced typeahead with thumbnails on browse page |
| Game comparison page | ✅ DONE | `/compare` — side-by-side comparison of up to 4 games |
| Game collections API | ✅ DONE | Full CRUD for user game lists with public sharing (migration 017) |
| Automated SEO blog | ✅ DONE | GPT-4o daily generation, 365 unique topics, Vercel cron, `/blog` pages |
| Refine filter fix | ✅ DONE | Player slider no longer mirrors questionnaire selection |

## Infrastructure Setup (March 27-28, 2026)

| Item | Status | Notes |
|------|--------|-------|
| Domain: boredgame.lol | ✅ DONE | Purchased via Squarespace, DNS on Cloudflare |
| Cloudflare DNS | ✅ DONE | Nameservers migrated, A record to Vercel |
| Email routing | ✅ DONE | info@ and contact@ forwarding via Cloudflare |
| Google Search Console | ✅ DONE | Domain verified, sitemap submitted |
| Google Analytics | ✅ DONE | G-5W6KCSVEJP tracking |
| Amazon Associates | ✅ DONE | Affiliate tag: boredgame-20 |
| Reddit account | ✅ DONE | Posted to r/sideproject |
| BGG forum post | ✅ DONE | Posted to Recommendations forum |
| Product Hunt | ⏳ WAITING | Account created, 1-week wait before posting |
| Google AdSense | ⏳ WAITING | Apply once traffic builds (3-5 days) |

## Pending Supabase Migrations

| Migration | Status | Notes |
|-----------|--------|-------|
| 014 — Trim dead games | ✅ RAN | Deleted 76k unrated games |
| 015 — Composite indexes | ✅ RAN | Browse + recommend query optimization |
| 016 — Newsletter subscribers | ✅ RAN | Email signup table |
| 017 — Game collections | ⬜ NEEDS RUN | User game lists |
| 018 — Blog posts | ✅ RAN | Automated blog storage |

## Future Roadmap

| Feature | Priority | Notes |
|---------|----------|-------|
| Google AdSense integration | HIGH | Apply once traffic builds, integrate ad code |
| Group voting ("What should we play?") | HIGH | Share link, everyone votes, viral growth mechanic |
| Game Night Planner | MEDIUM | Pick group size + time, get curated set of 3-5 games |
| Collections UI page | MEDIUM | Frontend for the collections API (backend done) |
| Sentry error tracking | LOW | Add when traffic warrants it |
| Feedback widget | LOW | More nuanced than thumbs up/down |
| Admin dashboard | LOW | User stats, rec quality metrics |
