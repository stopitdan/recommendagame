'use client';

import { useEffect, useState, useRef } from 'react';
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
import ShareGameButton from '@/components/ShareGameButton';
import OwnedButton from '@/components/OwnedButton';
import ReviewForm from '@/components/ReviewForm';
import ReviewList from '@/components/ReviewList';
import SimilarGames from '@/components/SimilarGames';
import type { Game } from '@/types/game';
import { formatGameType } from '@/lib/utils/format';
import { getPrimaryTypeConfig } from '@/lib/game-type-config';
import { Puzzle, Gamepad2, Type as TypeIcon, PartyPopper } from 'lucide-react';
import MechanicChip from '@/components/MechanicChip';
import ReportIssueButton from '@/components/ReportIssueButton';
import QuickStartGuide from '@/components/QuickStartGuide';
import GameNeighborhood from '@/components/GameNeighborhood';
import CrossTypeRecommendations from '@/components/CrossTypeRecommendations';
import JsonLd from '@/components/JsonLd';
import { Users, Clock, Brain, Calendar, BarChart3, ExternalLink, ShoppingCart, Trophy, UserCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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

  // JSON-LD structured data for rich Google results
  const isVideoGame = game.types?.includes('video');
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': isVideoGame ? 'VideoGame' : 'BoardGame',
    name: game.name,
    description: game.description,
    url: `https://boredgame.lol/games/${game.id}`,
    ...(game.imageUrl && { image: game.imageUrl }),
    ...(game.yearPublished && { datePublished: String(game.yearPublished) }),
    ...(game.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: game.rating.toFixed(1),
        bestRating: '10',
        worstRating: '1',
        ...(game.ratingCount && { ratingCount: game.ratingCount }),
      },
    }),
    ...(game.categories?.length && { genre: game.categories }),
    ...(game.playerCount && {
      numberOfPlayers: {
        '@type': 'QuantitativeValue',
        minValue: game.playerCount.min,
        maxValue: game.playerCount.max,
      },
    }),
  };

  const details: { label: string; value: string; Icon: LucideIcon }[] = [];
  if (game.playerCount) {
    const { min, max, recommended } = game.playerCount;
    const range = min === max ? `${min}` : `${min}–${max}`;
    details.push({ label: 'Players', value: recommended ? `${range} (best at ${recommended})` : range, Icon: Users });
  }
  if (game.playTime) {
    const { min, max, average } = game.playTime;
    if (average) {
      details.push({ label: 'Play Time', value: `~${average} min`, Icon: Clock });
    } else if (min && max) {
      details.push({ label: 'Play Time', value: `${min}–${max} min`, Icon: Clock });
    }
  }
  if (game.complexity) {
    const labels = ['', 'Chill', 'Casual', 'Medium', 'Complex', 'Brain Burner'];
    const label = labels[Math.round(game.complexity)] ?? '';
    details.push({ label: 'Complexity', value: `${game.complexity.toFixed(1)}/5 (${label})`, Icon: Brain });
  }
  if (game.yearPublished) {
    details.push({ label: 'Year', value: String(game.yearPublished), Icon: Calendar });
  }
  if (game.ratingCount) {
    details.push({ label: 'Ratings', value: game.ratingCount.toLocaleString(), Icon: BarChart3 });
  }
  if (game.rankOverall) {
    details.push({ label: 'BGG Rank', value: `#${game.rankOverall.toLocaleString()} on BGG`, Icon: Trophy });
  }
  if (game.numOwned) {
    details.push({ label: 'Owned', value: `${game.numOwned.toLocaleString()} owners`, Icon: UserCheck });
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <JsonLd data={jsonLd} />
      <Button variant="text" onClick={() => router.back()} sx={{ mb: 2 }}>
        &larr; Back
      </Button>

      {/* Parallax hero banner */}
      {game.imageUrl && (
        <ParallaxBanner src={game.imageUrl} alt={game.name} />
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
        {/* Image (hidden when parallax banner shows on mobile, visible on desktop as sidebar) */}
        {game.imageUrl && (
          <Box
            component="img"
            src={game.imageUrl}
            alt={game.name}
            sx={{
              display: { xs: 'none', md: 'block' },
              width: { md: 280 },
              height: 'auto',
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
                {game.types.map((t) => {
                  const cfg = getPrimaryTypeConfig([t]);
                  const icons: Record<string, React.ReactNode> = {
                    board: <Puzzle size={14} />,
                    video: <Gamepad2 size={14} />,
                    word: <TypeIcon size={14} />,
                    party: <PartyPopper size={14} />,
                    card: <Puzzle size={14} />,
                  };
                  return (
                    <Chip
                      key={t}
                      icon={icons[t] as React.ReactElement}
                      label={formatGameType(t)}
                      size="small"
                      sx={{ bgcolor: cfg.color, color: '#FFFFFF', fontWeight: 600 }}
                    />
                  );
                })}
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
              <OwnedButton gameId={game.id} />
              <ShareGameButton gameId={game.id} gameName={game.name} />
              <ShareInviteButton gameId={game.id} gameName={game.name} />
              <ReportIssueButton game={game} />
            </Box>
          </Box>

          {/* Designers & Publishers */}
          {(game.designers?.length || game.publishers?.length) && (
            <Box>
              {game.designers && game.designers.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Designed by {game.designers.join(', ')}
                </Typography>
              )}
              {game.publishers && game.publishers.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: game.designers?.length ? 0.5 : 0 }}>
                  {game.publishers.map((pub) => (
                    <Chip key={pub} label={pub} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                  ))}
                </Box>
              )}
            </Box>
          )}

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
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.25, color: 'primary.main' }}><d.Icon size={20} /></Box>
                <Typography variant="body2" fontWeight={600}>
                  {d.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {d.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Where to buy / links */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {game.sourceUrl && (
              <Button
                variant="outlined"
                size="small"
                href={game.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                component="a"
                startIcon={<ExternalLink size={14} />}
              >
                {game.source === 'bgg' ? 'BoardGameGeek' : game.source === 'rawg' ? 'RAWG' : game.source}
              </Button>
            )}
            <Button
              variant="contained"
              size="small"
              href={`https://www.amazon.com/s?k=${encodeURIComponent(game.name)}&tag=boredgame-20`}
              target="_blank"
              rel="noopener noreferrer"
              component="a"
              startIcon={<ShoppingCart size={14} />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Amazon
            </Button>
            {isVideoGame && (
              <Button
                variant="outlined"
                size="small"
                href={`https://store.steampowered.com/search/?term=${encodeURIComponent(game.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                component="a"
                startIcon={<ExternalLink size={14} />}
                sx={{ textTransform: 'none' }}
              >
                Steam
              </Button>
            )}
            {!isVideoGame && (
              <Button
                variant="outlined"
                size="small"
                href={`https://www.target.com/s?searchTerm=${encodeURIComponent(game.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                component="a"
                startIcon={<ExternalLink size={14} />}
                sx={{ textTransform: 'none' }}
              >
                Target
              </Button>
            )}
          </Box>
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

      {/* Quick Start Guide (AI-generated) */}
      <Box sx={{ mb: 4 }}>
        <QuickStartGuide
          gameId={game.id}
          gameName={game.name}
          hasDescription={(game.description?.length ?? 0) > 100}
          mechanicCount={game.mechanics.length}
        />
      </Box>

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
                  <MechanicChip key={m} name={m} />
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

      {/* Game neighborhood map -- hidden until map rearchitecture is polished
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Game Neighborhood
        </Typography>
        <GameNeighborhood gameId={game.id} />
      </Box>
      */}

      {/* Cross-type recommendations (board <-> video) */}
      <Box sx={{ mb: 4 }}>
        <CrossTypeRecommendations
          gameId={game.id}
          gameType={game.types[0] ?? 'board'}
          gameName={game.name}
          categories={game.categories}
          mechanics={game.mechanics}
        />
      </Box>

      {/* Similar games */}
      <Box sx={{ mb: 4 }}>
        <SimilarGames gameId={game.id} />
      </Box>
    </Container>
  );
}

/** Parallax hero banner — image scrolls at 50% speed */
function ParallaxBanner({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (ref.current) {
            const offset = window.scrollY * 0.4;
            ref.current.style.transform = `translateY(${offset}px)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Box
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'relative',
        height: 240,
        overflow: 'hidden',
        borderRadius: 3,
        mb: 3,
        mx: -2,
      }}
    >
      <Box
        ref={ref}
        component="img"
        src={src}
        alt={alt}
        sx={{
          width: '100%',
          height: '140%',
          objectFit: 'cover',
          position: 'absolute',
          top: '-20%',
          left: 0,
          willChange: 'transform',
        }}
      />
      {/* Gradient overlay at bottom */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: (theme) =>
            `linear-gradient(transparent, ${theme.palette.background.default})`,
        }}
      />
    </Box>
  );
}
