/**
 * Client-side cache bypass hook for admin/dev testing.
 *
 * Reads/writes a `__nocache` session cookie. When active, all
 * fetch() calls from useCachedFetch include the X-No-Cache header,
 * and the client-side cache is cleared.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { clearClientCache } from '@/lib/client-cache';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, path = '/') {
  document.cookie = `${name}=${encodeURIComponent(value)};path=${path}`;
}

function deleteCookie(name: string, path = '/') {
  document.cookie = `${name}=;path=${path};max-age=0`;
}

export function useCacheBypass() {
  const [isNoCacheMode, setIsNoCacheMode] = useState(false);

  useEffect(() => {
    setIsNoCacheMode(getCookie('__nocache') === '1');
  }, []);

  const toggleNoCache = useCallback(() => {
    setIsNoCacheMode((prev) => {
      const next = !prev;
      if (next) {
        setCookie('__nocache', '1');
        clearClientCache();
      } else {
        deleteCookie('__nocache');
      }
      return next;
    });
  }, []);

  return { isNoCacheMode, toggleNoCache };
}

/**
 * Check if nocache mode is active (non-hook, for use in fetch wrappers).
 */
export function isNoCacheActive(): boolean {
  return getCookie('__nocache') === '1';
}
