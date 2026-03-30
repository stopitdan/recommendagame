'use client';

import Chip from '@mui/material/Chip';

/**
 * Small "BETA" badge. Use next to page titles or in the header.
 */
export default function BetaBadge() {
  return (
    <Chip
      label="BETA"
      size="small"
      sx={{
        height: 20,
        fontSize: '0.6rem',
        fontWeight: 800,
        letterSpacing: '0.1em',
        bgcolor: 'secondary.main',
        color: 'secondary.contrastText',
        borderRadius: 1,
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
}
