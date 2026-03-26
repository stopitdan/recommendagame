'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import GameCard from '@/components/GameCard';
import type { Game } from '@/types/game';

interface ProfileData {
  email: string;
  displayName: string | null;
  favoriteCount: number;
  reviewCount: number;
  presetCount: number;
  favorites: Game[];
  recentReviews: Array<{
    id: number;
    game_id: string;
    game_name: string;
    rating: number;
    review_text: string | null;
    created_at: string;
  }>;
  presets: Array<{
    id: number;
    name: string;
    created_at: string;
  }>;
}

export default function ProfileHub() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/profile');
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (!res.ok) return;
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (!data) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Could not load profile</Typography>
        <Button variant="contained" onClick={() => router.push('/login')}>Log In</Button>
      </Container>
    );
  }

  const initials = (data.displayName || data.email || '?')
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Profile header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
        <Avatar
          sx={{
            width: 80,
            height: 80,
            fontSize: '2rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #5B4FDB, #FF6D3F)',
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight={800}>
            {data.displayName || 'Player'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data.email}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={() => router.push('/settings')}
        >
          Edit Settings
        </Button>
      </Box>

      {/* Stats cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { value: data.favoriteCount, label: 'Favorites', emoji: '❤️', color: '#FF6D3F' },
          { value: data.reviewCount, label: 'Reviews', emoji: '⭐', color: '#FFB020' },
          { value: data.presetCount, label: 'Presets', emoji: '📋', color: '#5B4FDB' },
        ].map((stat) => (
          <Grid size={{ xs: 4 }} key={stat.label}>
            <Card
              variant="outlined"
              sx={{
                textAlign: 'center',
                py: 2.5,
                borderColor: 'divider',
                transition: 'all 200ms',
                '&:hover': { borderColor: stat.color, boxShadow: `0 4px 16px ${stat.color}20` },
              }}
            >
              <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>{stat.emoji}</Typography>
              <Typography variant="h4" fontWeight={800} sx={{ color: stat.color }}>
                {stat.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 },
          '& .Mui-selected': { color: 'primary.main' },
          '& .MuiTabs-indicator': {
            background: 'linear-gradient(90deg, #5B4FDB, #FF6D3F)',
            height: 3,
            borderRadius: 2,
          },
        }}
      >
        <Tab label={`Favorites (${data.favoriteCount})`} />
        <Tab label={`Reviews (${data.reviewCount})`} />
        <Tab label={`Presets (${data.presetCount})`} />
      </Tabs>

      {/* Tab content */}
      {tab === 0 && (
        <Stack spacing={2}>
          {data.favorites.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                No favorites yet
              </Typography>
              <Button variant="contained" onClick={() => router.push('/find-a-game')}>
                Find Games to Favorite
              </Button>
            </Box>
          ) : (
            data.favorites.map((game) => (
              <GameCard key={game.id} game={game} isFavorited />
            ))
          )}
        </Stack>
      )}

      {tab === 1 && (
        <Stack spacing={2}>
          {data.recentReviews.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                No reviews yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Review games to help improve recommendations for everyone
              </Typography>
            </Box>
          ) : (
            data.recentReviews.map((review) => (
              <Card
                key={review.id}
                variant="outlined"
                sx={{ cursor: 'pointer', '&:hover': { boxShadow: 2 } }}
                onClick={() => router.push(`/games/${encodeURIComponent(review.game_id)}`)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" fontWeight={600}>
                      {review.game_name}
                    </Typography>
                    <Chip
                      label={`${review.rating}/10`}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        bgcolor: review.rating >= 7 ? 'success.light' : review.rating >= 5 ? 'warning.light' : 'error.light',
                        color: review.rating >= 7 ? 'success.main' : review.rating >= 5 ? 'warning.main' : 'error.main',
                      }}
                    />
                  </Box>
                  {review.review_text && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {review.review_text}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {new Date(review.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}

      {tab === 2 && (
        <Stack spacing={2}>
          {data.presets.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                No saved presets
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Save your questionnaire answers to quickly get recommendations again
              </Typography>
              <Button variant="contained" onClick={() => router.push('/find-a-game')}>
                Create a Preset
              </Button>
            </Box>
          ) : (
            data.presets.map((preset) => (
              <Card
                key={preset.id}
                variant="outlined"
                sx={{ cursor: 'pointer', '&:hover': { boxShadow: 2 } }}
                onClick={() => router.push(`/presets`)}
              >
                <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      {preset.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Created {new Date(preset.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Button variant="outlined" size="small">
                    Use Preset
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}
    </Container>
  );
}
