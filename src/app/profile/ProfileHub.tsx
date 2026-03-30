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
import { Heart, Star, ClipboardList, Package } from 'lucide-react';
import type { ReactNode } from 'react';
import GameCard from '@/components/GameCard';
import type { Game } from '@/types/game';

interface OwnedGame {
  game_id: string;
  source: string;
  added_at: string;
  game?: Game;
}

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
  const [ownedGames, setOwnedGames] = useState<OwnedGame[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, ownedRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/owned'),
        ]);
        if (profileRes.status === 401) {
          router.push('/login');
          return;
        }
        if (profileRes.ok) {
          const json = await profileRes.json();
          setData(json);
        }
        if (ownedRes.ok) {
          const ownedData = await ownedRes.json();
          setOwnedGames(ownedData.owned ?? []);
        }
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
          { value: ownedGames.length, label: 'Collection', icon: <Package size={24} /> as ReactNode, color: '#0EC6C6' },
          { value: data.favoriteCount, label: 'Favorites', icon: <Heart size={24} /> as ReactNode, color: '#FF6D3F' },
          { value: data.reviewCount, label: 'Reviews', icon: <Star size={24} /> as ReactNode, color: '#FFB020' },
          { value: data.presetCount, label: 'Presets', icon: <ClipboardList size={24} /> as ReactNode, color: '#5B4FDB' },
        ].map((stat) => (
          <Grid size={{ xs: 3 }} key={stat.label}>
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
              <Box sx={{ mb: 0.5, color: stat.color, display: 'flex', justifyContent: 'center' }}>{stat.icon}</Box>
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
        <Tab label={`My Collection (${ownedGames.length})`} />
        <Tab label={`Favorites (${data.favoriteCount})`} />
        <Tab label={`Reviews (${data.reviewCount})`} />
        <Tab label={`Presets (${data.presetCount})`} />
      </Tabs>

      {/* Tab content */}
      {/* My Collection tab */}
      {tab === 0 && (
        <Stack spacing={2}>
          {ownedGames.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                No games in your collection yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Sync your BGG account in Settings, or click the package icon on any game to add it.
              </Typography>
              <Button variant="contained" onClick={() => router.push('/settings')}>
                Connect BGG Account
              </Button>
            </Box>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {ownedGames.length} games in your collection. Use "My Collection Only" when searching to get picks from games you own.
              </Typography>
              {ownedGames.map((og) => (
                og.game ? (
                  <Box key={og.game_id} sx={{ position: 'relative' }}>
                    <GameCard game={og.game} showFavorite={false} />
                    <Chip
                      label={og.source === 'bgg' ? 'BGG' : 'Added manually'}
                      size="small"
                      variant="outlined"
                      color={og.source === 'bgg' ? 'primary' : 'default'}
                      sx={{ position: 'absolute', top: 8, right: 8 }}
                    />
                  </Box>
                ) : null
              ))}
            </>
          )}
        </Stack>
      )}

      {/* Favorites tab */}
      {tab === 1 && (
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

      {tab === 2 && (
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

      {tab === 3 && (
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
