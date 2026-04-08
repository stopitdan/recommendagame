/**
 * Implicit signal collection hook.
 *
 * Batches user behavior events (clicks, dwell time, scroll depth) and
 * flushes them to /api/track every 10 seconds or on page unload.
 * Generates a stable session ID per browser tab.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';

interface TrackEvent {
  type: string;
  gameId?: string;
  payload?: Record<string, unknown>;
}

// Stable session ID per tab (survives re-renders, not page reloads)
let sessionId: string | null = null;
function getSessionId(): string {
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  return sessionId;
}

// Shared buffer across all hook instances in this tab
const buffer: TrackEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  if (buffer.length === 0) return;

  const events = buffer.splice(0, buffer.length);
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, sessionId: getSessionId() }),
      // Use keepalive so the request survives page unload
      keepalive: true,
    });
  } catch {
    // Silent fail -- implicit signals are best-effort
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 10_000);
}

/**
 * Returns a `track` function that queues events for batched submission.
 *
 * Usage:
 *   const track = useSignalTracker();
 *   track('result_click', { gameId: '123', payload: { position: 3 } });
 */
export function useSignalTracker() {
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Flush on page unload
    const handleUnload = () => flush();
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      mounted.current = false;
      window.removeEventListener('beforeunload', handleUnload);
      // Flush remaining events on unmount
      flush();
    };
  }, []);

  const track = useCallback((type: string, opts?: { gameId?: string; payload?: Record<string, unknown> }) => {
    buffer.push({
      type,
      gameId: opts?.gameId,
      payload: opts?.payload,
    });
    scheduleFlush();
  }, []);

  return track;
}

/**
 * Hook that tracks dwell time on a page. Call on game detail pages.
 * Automatically sends a 'dwell' event when the user leaves.
 */
export function useDwellTracker(gameId: string) {
  const track = useSignalTracker();
  const startTime = useRef(Date.now());

  useEffect(() => {
    startTime.current = Date.now();

    return () => {
      const dwellMs = Date.now() - startTime.current;
      // Only track if they spent more than 2 seconds (filters out bounces)
      if (dwellMs > 2000) {
        track('dwell', { gameId, payload: { dwell_ms: dwellMs } });
      }
    };
  }, [gameId, track]);
}

/**
 * Hook that tracks scroll depth on a page. Sends the max scroll percentage
 * when the user leaves the page.
 */
export function useScrollDepthTracker(identifier?: string) {
  const track = useSignalTracker();
  const maxScroll = useRef(0);

  useEffect(() => {
    maxScroll.current = 0;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.round((scrollTop / docHeight) * 100);
        if (pct > maxScroll.current) maxScroll.current = pct;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (maxScroll.current > 10) {
        track('scroll_depth', {
          gameId: undefined,
          payload: { scroll_pct: maxScroll.current, page: identifier },
        });
      }
    };
  }, [identifier, track]);
}
