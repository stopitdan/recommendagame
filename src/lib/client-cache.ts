/**
 * Client-side fetch cache with stale-while-revalidate.
 *
 * Module-level Map shared across all components. Survives
 * navigation within the SPA but clears on full page reload.
 *
 * Used by useCachedFetch hook and can be called directly
 * for components with complex fetch logic (BrowseView, SearchAutocomplete).
 */

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 100;
const DEFAULT_STALE_MS = 60_000; // 1 minute before background refresh

export function getFromClientCache(
  url: string,
  staleMs = DEFAULT_STALE_MS,
): { data: unknown; isStale: boolean } | null {
  const entry = cache.get(url);
  if (!entry) return null;
  const isStale = Date.now() - entry.timestamp > staleMs;
  return { data: entry.data, isStale };
}

export function setInClientCache(url: string, data: unknown): void {
  // Evict oldest entry if at capacity
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(url, { data, timestamp: Date.now() });
}

export function clearClientCache(): void {
  cache.clear();
}
