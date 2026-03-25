'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { motion, AnimatePresence } from 'motion/react';
import Dice3D from '@/components/Dice3D';
import type { Game } from '@/types/game';

export default function RandomGameView() {
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [type, setType] = useState<string | null>(null);

  async function rollDice() {
    setRolling(true);
    setLoading(true);

    // Show rolling animation for at least 1 second
    const start = Date.now();
    try {
      const params = type ? `?type=${type}` : '';
      const res = await fetch(`/api/games/random${params}`);
      if (!res.ok) return;
      const data = await res.json();

      // Ensure rolling animation plays for minimum time (match 3D dice spin: 1.2s)
      const elapsed = Date.now() - start;
      if (elapsed < 1300) {
        await new Promise((r) => setTimeout(r, 1300 - elapsed));
      }

      setGame(data.game);
    } finally {
      setRolling(false);
      setLoading(false);
    }
  }

  const typeOptions = [
    { label: 'Any Game', value: null, emoji: '🎲' },
    { label: 'Board Game', value: 'board', emoji: '♟️' },
    { label: 'Video Game', value: 'video', emoji: '🎮' },
    { label: 'Word Game', value: 'word', emoji: '🔤' },
    { label: 'Party Game', value: 'party', emoji: '🎉' },
  ];

  return (
    <Container maxWidth="sm" sx={{ py: 6, textAlign: 'center' }}>
      <Stack spacing={4} alignItems="center">
        {/* 3D Dice */}
        <Dice3D rolling={rolling} onRoll={rollDice} />

        <Box>
          <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
            Roll the Dice
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Not sure what to play? Let fate decide.
          </Typography>
        </Box>

        {/* Type filter chips */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          {typeOptions.map((opt) => (
            <Chip
              key={opt.label}
              label={`${opt.emoji} ${opt.label}`}
              onClick={() => setType(opt.value)}
              color={type === opt.value ? 'primary' : 'default'}
              variant={type === opt.value ? 'filled' : 'outlined'}
            />
          ))}
        </Box>

        {/* Roll button */}
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="contained"
            size="large"
            onClick={rollDice}
            disabled={loading}
            sx={{ px: 6, py: 2, fontSize: '1.2rem', borderRadius: 3 }}
          >
            {loading ? 'Rolling...' : game ? 'Roll Again' : 'Roll!'}
          </Button>
        </motion.div>

        {/* Result */}
        <AnimatePresence mode="wait">
          {game && !rolling && (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: '100%' }}
            >
              <Card
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  transition: 'all 200ms',
                  '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
                }}
                onClick={() => router.push(`/games/${encodeURIComponent(game.id)}`)}
              >
                {(game as any).image_url && (
                  <Box
                    component="img"
                    src={(game as any).image_url}
                    alt={(game as any).name}
                    sx={{ width: '100%', height: 200, objectFit: 'cover' }}
                  />
                )}
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                    {(game as any).name}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, justifyContent: 'center' }}>
                    {(game as any).rating && (
                      <Chip
                        label={`⭐ ${Number((game as any).rating).toFixed(1)}`}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                    {(game as any).min_players && (
                      <Chip
                        label={`👥 ${(game as any).min_players}${(game as any).max_players && (game as any).max_players !== (game as any).min_players ? `–${(game as any).max_players}` : ''} players`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {(game as any).avg_play_time && (
                      <Chip
                        label={`⏱️ ${(game as any).avg_play_time} min`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  {(game as any).description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.6,
                      }}
                    >
                      {(game as any).description}
                    </Typography>
                  )}

                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ mt: 2 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/games/${encodeURIComponent(game.id)}`);
                    }}
                  >
                    View Details
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </Stack>
    </Container>
  );
}
