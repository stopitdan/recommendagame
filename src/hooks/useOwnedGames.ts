'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { getCachedUser } from '@/lib/supabase/client';

/**
 * Module-level cache for owned game IDs.
 * Shared across all OwnedButton instances so /api/owned is fetched once.
 */
let ownedSet = new Set<string>();
let fetchPromise: Promise<void> | null = null;
let hasFetched = false;
let listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() {
  return ownedSet;
}

function notify() {
  listeners.forEach((cb) => cb());
}

async function fetchOwned() {
  if (fetchPromise) return fetchPromise;
  if (hasFetched) return;

  fetchPromise = (async () => {
    try {
      const user = await getCachedUser();
      if (!user) return;

      const res = await fetch('/api/owned');
      if (!res.ok) return;
      const data = await res.json();
      const ids = (data.owned ?? []).map((o: { game_id: string }) => o.game_id);
      ownedSet = new Set(ids);
      hasFetched = true;
      notify();
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * Shared hook: fetches owned games once, shares across all consumers.
 * Returns { owned, isOwned, toggle, isLoggedIn }.
 */
export function useOwnedGames() {
  const set = useSyncExternalStore(subscribe, getSnapshot, () => new Set<string>());
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    getCachedUser().then((user) => {
      if (user) {
        setIsLoggedIn(true);
        fetchOwned();
      }
    });
  }, []);

  const toggle = useCallback(async (gameId: string) => {
    const wasOwned = ownedSet.has(gameId);
    // Optimistic update
    const next = new Set(ownedSet);
    if (wasOwned) next.delete(gameId);
    else next.add(gameId);
    ownedSet = next;
    notify();

    try {
      const res = await fetch('/api/owned', {
        method: wasOwned ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      });
      if (!res.ok) {
        // Revert
        const reverted = new Set(ownedSet);
        if (wasOwned) reverted.add(gameId);
        else reverted.delete(gameId);
        ownedSet = reverted;
        notify();
        return wasOwned;
      }
      return !wasOwned;
    } catch {
      // Revert
      const reverted = new Set(ownedSet);
      if (wasOwned) reverted.add(gameId);
      else reverted.delete(gameId);
      ownedSet = reverted;
      notify();
      return wasOwned;
    }
  }, []);

  return { ownedSet: set, isLoggedIn, toggle };
}

/** Convenience: check + toggle for a single game */
export function useIsOwned(gameId: string) {
  const { ownedSet: set, isLoggedIn, toggle } = useOwnedGames();
  const owned = set.has(gameId);
  const toggleThis = useCallback(() => toggle(gameId), [toggle, gameId]);
  return { owned, isLoggedIn, toggle: toggleThis };
}
