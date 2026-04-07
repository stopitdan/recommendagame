'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { MessageSquareText, SlidersHorizontal, Sparkles, Puzzle } from 'lucide-react';
import { getCachedUser } from '@/lib/supabase/client';

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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [bggUsername, setBggUsername] = useState('');
  const [bggSyncing, setBggSyncing] = useState(false);
  const [bggResult, setBggResult] = useState<string | null>(null);
  const [step, setStep] = useState<'welcome' | 'bgg'>('welcome');

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;

    const timer = setTimeout(async () => {
      const user = await getCachedUser();
      setIsLoggedIn(!!user);
      setOpen(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  function handleNext() {
    if (isLoggedIn) {
      setStep('bgg');
    } else {
      handleDismiss();
    }
  }

  async function handleBggSync() {
    if (!bggUsername.trim()) return;
    setBggSyncing(true);
    setBggResult(null);
    try {
      const res = await fetch('/api/bgg/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: bggUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setBggResult(`Synced! ${data.matched} games matched, ${data.feedbackCreated} ratings imported.`);
      setTimeout(handleDismiss, 3000);
    } catch (err) {
      setBggResult(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setBggSyncing(false);
    }
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
        {step === 'welcome' ? (
          <>
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
              onClick={handleNext}
              sx={{ fontWeight: 700, borderRadius: 2, py: 1.5 }}
            >
              {isLoggedIn ? 'Next' : 'Let\u0027s go'}
            </Button>
          </>
        ) : (
          <>
            <Box sx={{ color: 'primary.main', mb: 1 }}>
              <Puzzle size={40} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
              Got a BGG account?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Connect your BoardGameGeek account and we&apos;ll import your collection
              and ratings for much better personalized recommendations.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                size="small"
                placeholder="Your BGG username"
                value={bggUsername}
                onChange={(e) => setBggUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBggSync()}
                fullWidth
              />
              <Button
                variant="contained"
                onClick={handleBggSync}
                disabled={bggSyncing || !bggUsername.trim()}
                sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {bggSyncing ? 'Syncing...' : 'Sync'}
              </Button>
            </Box>

            {bggResult && (
              <Alert severity={bggResult.startsWith('Synced') ? 'success' : 'error'} sx={{ mb: 2 }}>
                {bggResult}
              </Alert>
            )}

            <Button
              variant="text"
              fullWidth
              onClick={handleDismiss}
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              Skip for now
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
