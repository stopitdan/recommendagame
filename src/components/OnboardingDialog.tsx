'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { MessageSquareText, SlidersHorizontal, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'onboarding-seen';

const STEPS = [
  {
    icon: <MessageSquareText size={28} />,
    title: 'Describe what you want',
    description: 'Start by telling us in your own words what kind of game you\'re looking for. Our AI will understand you.',
  },
  {
    icon: <SlidersHorizontal size={28} />,
    title: 'Fine-tune your preferences',
    description: 'Pick game types, time, complexity, genres, and vibes. The more you tell us, the better the results.',
  },
  {
    icon: <Sparkles size={28} />,
    title: 'Get personalized picks',
    description: 'We\'ll score 100,000+ games and show you the best matches. Thumbs up or down to teach us your taste.',
  },
];

export default function OnboardingDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so it doesn't compete with the page load
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onClose={handleDismiss}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogContent sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
          Welcome to boredgame.lol
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Here&apos;s how it works:
        </Typography>

        <Stack spacing={2.5} sx={{ mb: 3, textAlign: 'left' }}>
          {STEPS.map((s, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{
                flexShrink: 0,
                width: 48,
                height: 48,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}>
                {s.icon}
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {s.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  {s.description}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={handleDismiss}
          sx={{ fontWeight: 700, borderRadius: 2, py: 1.5 }}
        >
          Let&apos;s go
        </Button>
      </DialogContent>
    </Dialog>
  );
}
