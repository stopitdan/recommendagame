'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import { MECHANIC_DESCRIPTIONS } from '@/data/mechanic-descriptions';

interface MechanicChipProps {
  name: string;
  /** Size variant passed to MUI Chip */
  size?: 'small' | 'medium';
}

/**
 * A mechanic chip that shows a description popover on click.
 * If no description exists for the mechanic, renders as a plain chip
 * that links to the browse page.
 */
export default function MechanicChip({ name, size = 'small' }: MechanicChipProps) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const info = MECHANIC_DESCRIPTIONS[name];

  function handleClick(e: React.MouseEvent<HTMLElement>) {
    if (info) {
      e.stopPropagation();
      setAnchorEl(e.currentTarget);
    } else {
      router.push(`/browse?mechanic=${encodeURIComponent(name)}`);
    }
  }

  return (
    <>
      <Chip
        label={name}
        size={size}
        onClick={handleClick}
        clickable
        sx={{
          cursor: info ? 'help' : 'pointer',
          '&:hover': { borderColor: 'primary.main' },
        }}
      />
      {info && (
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          onClick={(e) => e.stopPropagation()}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{ paper: { sx: { p: 2, maxWidth: 320, borderRadius: 2 } } }}
        >
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            {name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {info.description}
          </Typography>
          {info.examples.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              Examples: {info.examples.join(', ')}
            </Typography>
          )}
          <Box sx={{ mt: 1.5 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setAnchorEl(null);
                router.push(`/browse?mechanic=${encodeURIComponent(name)}`);
              }}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Browse games with {name}
            </Button>
          </Box>
        </Popover>
      )}
    </>
  );
}
