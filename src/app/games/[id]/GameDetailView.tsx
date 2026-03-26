'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AnimatedRating from '@/components/AnimatedRating';
import FavoriteButton from '@/components/FavoriteButton';
import ShareInviteButton from '@/components/ShareInviteButton';
import ReviewForm from '@/components/ReviewForm';
import ReviewList from '@/components/ReviewList';
import SimilarGames from '@/components/SimilarGames';
import type { Game } from '@/types/game';
import { formatGameType } from '@/lib/utils/format';

export default function GameDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchGame() {
      try {
        const res = await fetch(`/api/games/${encodeURIComponent(id)}`);
        if (!res.ok) return;
        const data = await res.json();
        setGame(data.game);
      } finally {
        setLoading(false);
      }
    }
    fetchGame();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress sx={{ color: 'secondary.main' }} />
      </Box>
    );
  }

  if (!game) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary" sx={{ mb: 2 }}>
          Game not found
        </Typography>
        <Button variant="contained" onClick={() => router.push('/find-a-game')}>
          Find Games
        </Button>
      </Container>
    );
  }

  const details: { label: string; value: string; emoji: string }[] = [];
  if (game.playerCount) {
    const { min, max, recommended } = game.playerCount;
    const range = min === max ? `${min}` : `${min}–${max}`;
    details.push({ label: 'Players', value: recommended ? `${range} (best at ${recommended})` : range, emoji: '👥' });
  }
  if (game.playTime) {
    const { min, max, average } = game.playTime;
    if (average) {
      details.push({ label: 'Play Time', value: `~${average} min`, emoji: '⏱️' });
    } else if (min && max) {
      details.push({ label: 'Play Time', value: `${min}–${max} min`, emoji: '⏱️' });
    }
  }
  if (game.complexity) {
    const labels = ['', 'Chill', 'Casual', 'Medium', 'Complex', 'Brain Burner'];
    const label = labels[Math.round(game.complexity)] ?? '';
    details.push({ label: 'Complexity', value: `${game.complexity.toFixed(1)}/5 (${label})`, emoji: '🧠' });
  }
  if (game.yearPublished) {
    details.push({ label: 'Year', value: String(game.yearPublished), emoji: '📅' });
  }
  if (game.ratingCount) {
    details.push({ label: 'Ratings', value: game.ratingCount.toLocaleString(), emoji: '📊' });
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button variant="text" onClick={() => router.back()} sx={{ mb: 2 }}>
        &larr; Back
      </Button>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
        {/* Image */}
        {game.imageUrl && (
          <Box
            component="img"
            src={game.imageUrl}
            alt={game.name}
            sx={{
              width: { xs: '100%', md: 280 },
              height: { xs: 240, md: 'auto' },
              maxHeight: 400,
              objectFit: 'cover',
              borderRadius: 2,
              flexShrink: 0,
            }}
          />
        )}

        {/* Info */}
        <Stack spacing={2} sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h3" fontWeight={800} sx={{ lineHeight: 1.1, mb: 0.5 }}>
                {game.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {game.types.map((t) => (
                  <Chip key={t} label={formatGameType(t)} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              {game.rating && (
                <Chip
                  label={<AnimatedRating value={game.rating} delay={200} />}
                  sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 700, fontSize: '1rem', py: 2 }}
                />
              )}
              <FavoriteButton gameId={game.id} />
              <ShareInviteButton gameId={game.id} gameName={game.name} />
            </Box>
          </Box>

          {/* Details grid */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {details.map((d) => (
              <Box
                key={d.label}
                sx={{
                  minWidth: 110,
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  textAlign: 'center',
                  transition: 'all 150ms',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(91, 79, 219, 0.04)' },
                }}
              >
                <Typography sx={{ fontSize: '1.2rem', mb: 0.25 }}>{d.emoji}</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {d.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {d.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Source link */}
          {game.sourceUrl && (
            <Box>
              <Button
                variant="outlined"
                size="small"
                href={game.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                component="a"
              >
                View on {game.source === 'bgg' ? 'BoardGameGeek' : game.source === 'rawg' ? 'RAWG' : game.source}
              </Button>
            </Box>
          )}
        </Stack>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Description */}
      {game.description && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
            About
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8, whiteSpace: 'pre-line' }}>
            {game.description}
          </Typography>
        </Box>
      )}

      {/* Categories & Mechanics */}
      {(game.categories.length > 0 || game.mechanics.length > 0) && (
        <Box sx={{ mb: 4 }}>
          {game.categories.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Categories
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {game.categories.map((c) => (
                  <Chip key={c} label={c} size="small" clickable onClick={() => router.push(`/browse?category=${encodeURIComponent(c)}`)} />
                ))}
              </Box>
            </Box>
          )}
          {game.mechanics.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Mechanics
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {game.mechanics.map((m) => (
                  <Chip key={m} label={m} size="small" variant="outlined" clickable onClick={() => router.push(`/browse?mechanic=${encodeURIComponent(m)}`)} />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Themes */}
      {game.themes.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Themes
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {game.themes.map((t) => (
              <Chip key={t} label={t} size="small" variant="outlined" clickable onClick={() => router.push(`/browse?theme=${encodeURIComponent(t)}`)} />
            ))}
          </Box>
        </Box>
      )}

      {/* Platforms (video games) */}
      {game.platforms.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Platforms
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {game.platforms.map((p) => (
              <Chip key={p} label={p} size="small" clickable onClick={() => router.push(`/browse?platform=${encodeURIComponent(p)}`)} />
            ))}
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 4 }} />

      {/* Reviews */}
      <Box sx={{ mb: 4 }}>
        <ReviewForm
          gameId={game.id}
          gameAvgRating={game.rating ?? undefined}
          onSubmit={() => setReviewRefreshKey((k) => k + 1)}
        />
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Reviews
        </Typography>
        <ReviewList gameId={game.id} refreshKey={reviewRefreshKey} />
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Similar games */}
      <Box sx={{ mb: 4 }}>
        <SimilarGames gameId={game.id} />
      </Box>
    </Container>
  );
}
