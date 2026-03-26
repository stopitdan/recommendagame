'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';

export default function ShareInviteButton({ gameId, gameName }: { gameId: string; gameName: string }) {
  const [copied, setCopied] = useState(false);

  function share() {
    const url = `${window.location.origin}/invite?game=${encodeURIComponent(gameId)}&host=${encodeURIComponent('A friend')}`;

    if (navigator.share) {
      navigator.share({
        title: `Game Night: ${gameName}`,
        text: `Join me for game night! We're playing ${gameName}`,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <Tooltip title={copied ? 'Link copied!' : 'Share game night invite'}>
      <Button
        variant="outlined"
        size="small"
        onClick={share}
        sx={{ minWidth: 0, px: 1.5 }}
      >
        {copied ? '✓' : '📤'}
      </Button>
    </Tooltip>
  );
}
