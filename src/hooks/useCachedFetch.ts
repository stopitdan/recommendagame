/**
 * Client-side fetch hook with stale-while-revalidate caching.
 *
 * On mount, checks the client-side cache (module-level Map).
 * - Fresh hit: returns data immediately, no fetch.
 * - Stale hit: returns data immediately, refreshes in background.
 * - Miss: fetches from server, caches result.
 *
 * When nocache mode is active (admin toggle), cache reads are skipped
 * but writes still happen so future requests benefit.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { getFromClientCache, setInClientCache } from '@/lib/client-cache';
import { isNoCacheActive } from '@/hooks/useCacheBypass';

interface UseCachedFetchOptions<T> {
  /** Transform the raw JSON response before storing */
  transform?: (data: unknown) => T;
  /** Custom stale threshold in ms (default: 60s) */
  staleTTL?: number;
}

interface UseCachedFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useCachedFetch<T>(
  url: string | null,
  options?: UseCachedFetchOptions<T>,
): UseCachedFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }

    const transform = options?.transform ?? ((d: unknown) => d as T);
    const staleTTL = options?.staleTTL;
    const nocache = isNoCacheActive();

    // Check client cache (skip in nocache mode)
    if (!nocache) {
      const cached = getFromClientCache(url, staleTTL);
      if (cached) {
        setData(transform(cached.data));
        if (!cached.isStale) {
          setLoading(false);
          return; // Fresh cache hit, done
        }
        // Stale hit: show cached data but continue to fetch fresh
        setLoading(false);
      }
    }

    // Fetch from server
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const headers: HeadersInit = {};
    if (nocache) headers['X-No-Cache'] = '1';

    fetch(url, { signal: controller.signal, headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setInClientCache(url, json);
        setData(transform(json));
        setError(null);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { data, loading, error };
}
