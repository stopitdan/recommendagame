'use client';

import { useState, useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Package, PackageCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface OwnedButtonProps {
  gameId: string;
  initialOwned?: boolean;
  onToggle?: (owned: boolean) => void;
}

/**
 * "I Own This" toggle button. Separate from the heart/favorite.
 * Adds/removes from user_owned_games table.
 */
export default function OwnedButton({ gameId, initialOwned = false, onToggle }: OwnedButtonProps) {
  const [owned, setOwned] = useState(initialOwned);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setIsLoggedIn(true);
      // Check if user owns this game
      fetch('/api/owned')
        .then((r) => r.ok ? r.json() : { owned: [] })
        .then((data) => {
          const owns = (data.owned ?? []).some((o: { game_id: string }) => o.game_id === gameId);
          setOwned(owns);
        });
    });
  }, [gameId]);

  if (!isLoggedIn) return null;

  async function toggle() {
    setLoading(true);
    const newOwned = !owned;
    setOwned(newOwned); // Optimistic

    try {
      const res = await fetch('/api/owned', {
        method: newOwned ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      });
      if (!res.ok) setOwned(!newOwned); // Revert on failure
      else onToggle?.(newOwned);
    } catch {
      setOwned(!newOwned);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Tooltip title={owned ? 'Remove from my collection' : 'I own this game'}>
      <IconButton
        onClick={toggle}
        disabled={loading}
        size="small"
        aria-label={owned ? 'Remove from collection' : 'Add to collection'}
        sx={{
          color: owned ? 'secondary.main' : 'divider',
          transition: 'color 200ms ease',
          '&:hover': { color: 'secondary.main' },
        }}
      >
        {owned ? <PackageCheck size={20} /> : <Package size={20} />}
      </IconButton>
    </Tooltip>
  );
}
