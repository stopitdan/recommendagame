'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';

export interface GameCardActionsProps {
  gameId: string;
  onDismiss?: (gameId: string) => void;
  onMoreLikeThis?: (gameId: string) => void;
}

const DISMISS_REASONS = [
  'Wrong genre',
  'Too complex',
  'Too simple',
  'Wrong player count',
  'Too long',
  'Already own it',
  'Already played it',
  'Not interested',
];

export default function GameCardActions({ gameId, onDismiss, onMoreLikeThis }: GameCardActionsProps) {
  const [dismissed, setDismissed] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [reasonText, setReasonText] = useState('');

  function handleDismissClick(e: React.MouseEvent<HTMLElement>) {
    setAnchorEl(e.currentTarget);
  }

  function submitDismiss(reason?: string) {
    setDismissed(true);
    setAnchorEl(null);

    const context = reason || reasonText.trim() || 'not-this';

    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, rating: -1, context }),
    }).catch(() => {});

    onDismiss?.(gameId);
  }

  function handleSkipReason() {
    submitDismiss('not-this');
  }

  function handleMoreLikeThis() {
    onMoreLikeThis?.(gameId);
  }

  return (
    <>
      <Tooltip title="Not this">
        <IconButton
          onClick={handleDismissClick}
          disabled={dismissed}
          size="small"
          aria-label="Not this game"
          sx={{
            color: 'text.disabled',
            transition: 'color 200ms ease',
            '&:hover': { color: 'error.main' },
          }}
        >
          <motion.div whileTap={{ scale: 0.8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
            </svg>
          </motion.div>
        </IconButton>
      </Tooltip>

      {/* Why did you dislike this? popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleSkipReason}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { p: 2, maxWidth: 280, borderRadius: 2 } } }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          What was wrong?
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          This helps us give you better recommendations.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
          {DISMISS_REASONS.map((reason) => (
            <Chip
              key={reason}
              label={reason}
              size="small"
              variant="outlined"
              onClick={() => submitDismiss(reason)}
              sx={{ cursor: 'pointer', '&:hover': { borderColor: 'error.main' } }}
            />
          ))}
        </Box>
        <TextField
          size="small"
          placeholder="Other reason..."
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitDismiss()}
          fullWidth
          sx={{ mb: 1 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button size="small" onClick={handleSkipReason} sx={{ textTransform: 'none' }}>
            Skip
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => submitDismiss()}
            disabled={!reasonText.trim()}
            sx={{ textTransform: 'none' }}
          >
            Submit
          </Button>
        </Box>
      </Popover>

      <Tooltip title="More like this">
        <IconButton
          onClick={handleMoreLikeThis}
          size="small"
          aria-label="More like this game"
          sx={{
            color: 'text.disabled',
            transition: 'color 200ms ease',
            '&:hover': { color: 'success.main' },
          }}
        >
          <motion.div whileTap={{ scale: 0.8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </motion.div>
        </IconButton>
      </Tooltip>
    </>
  );
}
