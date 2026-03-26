'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import type { Game } from '@/types/game';
import { formatGameType } from '@/lib/utils/format';

export default function InviteView() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get('game');
  const host = searchParams.get('host') ?? 'Someone';

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) { setLoading(false); return; }

    fetch(`/api/games/${encodeURIComponent(gameId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setGame(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gameId]);

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="text.secondary">Loading invite...</Typography>
      </Box>
    );
  }

  if (!game) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Invite not found</Typography>
        <Button variant="contained" href="/find-a-game">Find a Game</Button>
      </Box>
    );
  }

  return (
    <Stack spacing={3} alignItems="center" textAlign="center">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: '100%' }}
      >
        {/* Invite header */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '3rem', mb: 1 }}>🎲</Typography>
          <Typography variant="h4" fontWeight={800}>
            Game Night!
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>
            {host} invited you to play
          </Typography>
        </Box>

        {/* Game card */}
        <Card
          variant="outlined"
          sx={{
            overflow: 'hidden',
            border: '2px solid',
            borderColor: 'primary.main',
            boxShadow: '0 8px 30px rgba(91, 79, 219, 0.15)',
          }}
        >
          {game.imageUrl && (
            <Box
              component="img"
              src={game.imageUrl}
              alt={game.name}
              sx={{ width: '100%', height: 220, objectFit: 'cover' }}
            />
          )}
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
              {game.name}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mb: 2 }}>
              {game.types.map((t) => (
                <Chip key={t} label={formatGameType(t)} size="small" variant="outlined" />
              ))}
              {game.rating && (
                <Chip label={`⭐ ${game.rating.toFixed(1)}`} size="small" sx={{ fontWeight: 600 }} />
              )}
              {game.playerCount && (
                <Chip
                  label={`👥 ${game.playerCount.min}${game.playerCount.max !== game.playerCount.min ? `–${game.playerCount.max}` : ''} players`}
                  size="small"
                  variant="outlined"
                />
              )}
              {game.playTime?.average && (
                <Chip label={`⏱️ ${game.playTime.average} min`} size="small" variant="outlined" />
              )}
            </Box>

            {game.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.6,
                  mb: 2,
                }}
              >
                {game.description}
              </Typography>
            )}

            {game.categories.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                {game.categories.slice(0, 4).map((c) => (
                  <Chip key={c} label={c} size="small" />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* CTA */}
        <Stack spacing={2} sx={{ mt: 3 }}>
          <Button
            variant="contained"
            size="large"
            href={`/games/${encodeURIComponent(game.id)}`}
            sx={{ py: 1.5, fontSize: '1.1rem' }}
          >
            View Game Details
          </Button>
          <Button
            variant="outlined"
            size="large"
            href="/find-a-game"
          >
            Find More Games
          </Button>
        </Stack>
      </motion.div>
    </Stack>
  );
}
