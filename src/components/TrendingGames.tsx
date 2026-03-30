'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardMedia from '@mui/material/CardMedia';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import { Flame } from 'lucide-react';
import type { Game } from '@/types/game';

export default function TrendingGames() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/games/trending')
      .then((res) => res.json())
      .then((data) => setGames(data.games ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && games.length === 0) return null;

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Flame size={22} color="#FF6D3F" />
        <Typography variant="h5" fontWeight={700}>
          Trending Right Now
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 1,
          scrollSnapType: 'x mandatory',
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
        }}
      >
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Box key={i} sx={{ minWidth: 140, scrollSnapAlign: 'start' }}>
                <Skeleton variant="rounded" width={140} height={180} sx={{ borderRadius: 2 }} />
                <Skeleton width={100} sx={{ mt: 0.5 }} />
              </Box>
            ))
          : games.map((game) => (
              <motion.div
                key={game.id}
                whileHover={{ y: -4, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{ scrollSnapAlign: 'start' }}
              >
                <Card
                  variant="outlined"
                  sx={{
                    minWidth: 140,
                    maxWidth: 140,
                    transition: 'all 200ms',
                    '&:hover': { borderColor: 'secondary.main', boxShadow: '0 4px 16px rgba(255,109,63,0.15)' },
                  }}
                >
                  <CardActionArea onClick={() => router.push(`/games/${encodeURIComponent(game.id)}`)}>
                    {game.imageUrl ? (
                      <CardMedia
                        component="img"
                        image={game.imageUrl}
                        alt={game.name}
                        sx={{ height: 160, objectFit: 'cover' }}
                      />
                    ) : (
                      <Box sx={{ height: 160, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Flame size={32} color="#FF6D3F" />
                      </Box>
                    )}
                    <Box sx={{ p: 1 }}>
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.3,
                        }}
                      >
                        {game.name}
                      </Typography>
                      {game.rating && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                          {game.rating.toFixed(1)}/10
                        </Typography>
                      )}
                    </Box>
                  </CardActionArea>
                </Card>
              </motion.div>
            ))}
      </Box>
    </Container>
  );
}
