'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { CalendarDays, Star, Users, Clock } from 'lucide-react';
import type { Game } from '@/types/game';
import { formatGameType } from '@/lib/utils/format';
import AnimatedRating from './AnimatedRating';

export default function DailyPick() {
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    fetch('/api/daily-pick')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.game) setGame(data.game); })
      .catch(() => {});
  }, []);

  if (!game) return null;

  return (
    <Container maxWidth="md">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, justifyContent: 'center' }}>
        <CalendarDays size={20} />
        <Typography variant="h5" fontWeight={700}>
          Game of the Day
        </Typography>
      </Box>

      <Card
        variant="outlined"
        sx={{
          cursor: 'pointer',
          overflow: 'hidden',
          transition: 'all 200ms',
          '&:hover': { borderColor: 'primary.main', boxShadow: (t) => `0 8px 32px ${t.palette.primary.main}15` },
        }}
        onClick={() => router.push(`/games/${encodeURIComponent(game.id)}`)}
      >
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
          {game.imageUrl && (
            <Box
              component="img"
              src={game.imageUrl}
              alt={game.name}
              sx={{
                width: { xs: '100%', sm: 240 },
                height: { xs: 200, sm: 'auto' },
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          )}
          <CardContent sx={{ p: 3, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
              <Box>
                <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2, mb: 0.5 }}>
                  {game.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {game.types.map((t) => (
                    <Chip key={t} label={formatGameType(t)} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>
              {game.rating && (
                <Chip
                  icon={<Star size={14} fill="currentColor" /> as React.ReactElement}
                  label={<AnimatedRating value={game.rating} delay={300} />}
                  color="primary"
                  sx={{ fontWeight: 700 }}
                />
              )}
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {game.description}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {game.playerCount && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                  <Users size={14} />
                  <Typography variant="caption">
                    {game.playerCount.min === game.playerCount.max
                      ? `${game.playerCount.min} players`
                      : `${game.playerCount.min}-${game.playerCount.max} players`}
                  </Typography>
                </Box>
              )}
              {game.playTime?.average && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                  <Clock size={14} />
                  <Typography variant="caption">{game.playTime.average} min</Typography>
                </Box>
              )}
              {game.yearPublished && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                  <CalendarDays size={14} />
                  <Typography variant="caption">{game.yearPublished}</Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Box>
      </Card>
    </Container>
  );
}
