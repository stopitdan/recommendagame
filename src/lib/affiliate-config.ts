/**
 * Centralized affiliate link configuration.
 *
 * All affiliate tags and URL templates in one place so they stay consistent
 * between game pages (BuyOptions.tsx) and blog post generation.
 *
 * To add a new retailer:
 * 1. Apply for their affiliate program (see docs/BLOG-OVERHAUL-NOTES.md)
 * 2. Add the tag/ID here
 * 3. BuyOptions.tsx and the blog generator will pick it up automatically
 */

export const AFFILIATE_TAGS = {
  /** Amazon Associates -- active */
  amazon: 'boredgame-20',

  /** Target Partners via Impact.com -- apply at https://affiliate.target.com */
  target: null as string | null,

  /** Walmart Affiliate via Impact.com -- apply at https://affiliates.walmart.com */
  walmart: null as string | null,

  /** GameNerdz -- check footer or email directly */
  gamenerdz: null as string | null,
} as const;

// ── URL Builders ─────────────────────────────────────────────

export function amazonUrl(gameName: string): string {
  const q = encodeURIComponent(gameName);
  return `https://www.amazon.com/s?k=${q}&tag=${AFFILIATE_TAGS.amazon}`;
}

export function targetUrl(gameName: string): string {
  const q = encodeURIComponent(gameName);
  const tag = AFFILIATE_TAGS.target;
  const base = `https://www.target.com/s?searchTerm=${q}`;
  return tag ? `${base}&affiliate_id=${tag}` : base;
}

export function walmartUrl(gameName: string): string {
  const q = encodeURIComponent(gameName);
  const tag = AFFILIATE_TAGS.walmart;
  const base = `https://www.walmart.com/search?q=${q}`;
  return tag ? `${base}&affiliate_id=${tag}` : base;
}

export function gamenerdzUrl(gameName: string): string {
  const q = encodeURIComponent(gameName);
  return `https://www.gamenerdz.com/catalogsearch/result/?q=${q}`;
}
