'use client';

import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Package, PackageCheck } from 'lucide-react';
import { useIsOwned } from '@/hooks/useOwnedGames';

interface OwnedButtonProps {
  gameId: string;
  initialOwned?: boolean;
  onToggle?: (owned: boolean) => void;
}

/**
 * "I Own This" toggle button. Separate from the heart/favorite.
 * Uses shared hook so /api/owned is fetched once for all instances.
 */
export default function OwnedButton({ gameId, onToggle }: OwnedButtonProps) {
  const { owned, isLoggedIn, toggle } = useIsOwned(gameId);
  const [loading, setLoading] = useState(false);

  if (!isLoggedIn) return null;

  async function handleToggle() {
    setLoading(true);
    try {
      const newOwned = await toggle();
      onToggle?.(newOwned);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Tooltip title={owned ? 'Remove from my collection' : 'I own this game'}>
      <IconButton
        onClick={handleToggle}
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
