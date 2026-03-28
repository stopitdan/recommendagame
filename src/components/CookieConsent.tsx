'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Link from 'next/link';

const STORAGE_KEY = 'cookie-consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if user hasn't already made a choice
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  function handleChoice(value: 'accepted' | 'rejected') {
    localStorage.setItem(STORAGE_KEY, value);
    // Dispatch event so same-tab listeners (e.g. GoogleAnalytics) can react
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: value }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1400, // Above MUI AppBar (1100) and Drawer (1200)
        p: { xs: 1.5, sm: 2 },
        pointerEvents: 'none',
      }}
    >
      <Paper
        elevation={8}
        sx={{
          maxWidth: 600,
          mx: 'auto',
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
          pointerEvents: 'auto',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            We use cookies for authentication, analytics, and advertising. By clicking
            &quot;Accept,&quot; you consent to our use of cookies. See our{' '}
            <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>
              Privacy Policy
            </Link>{' '}
            for details.
          </Typography>

          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleChoice('rejected')}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Reject non-essential
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleChoice('accepted')}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Accept all
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
