'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Dice5, Puzzle, Gamepad2, Type, PartyPopper, Users, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Game } from '@/types/game';
import AnimatedRating from '@/components/AnimatedRating';
import { useAchievements } from '@/components/AchievementToast';
import DiceCustomizer from '@/components/DiceCustomizer';
import JsonLd from '@/components/JsonLd';
import { getSkin, DEFAULT_SKIN_ID, type DiceSkin } from '@/lib/dice-skins';
import { resolveCustomSkin } from '@/lib/custom-dice-utils';
import { createClient } from '@/lib/supabase/client';
import { triggerEpicNat20 } from '@/lib/nat20-celebration';
import type { CustomDiceSkinSummary } from '@/types/custom-dice';

// Dynamic import — Three.js can't SSR
const PhysicsDice = dynamic(() => import('@/components/PhysicsDice'), {
  ssr: false,
  loading: () => (
    <Box sx={{ width: '100%', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress size={32} sx={{ color: 'primary.main' }} />
    </Box>
  ),
});

/** Screen shake via CSS animation on the body */
function triggerScreenShake() {
  const el = document.body;
  el.style.animation = 'none';
  // Force reflow
  void el.offsetHeight;
  el.style.animation = 'critfail-shake 1.2s ease-out';
  setTimeout(() => { el.style.animation = 'none'; }, 1300);

  // Inject the keyframes if not already present
  if (!document.getElementById('critfail-shake-style')) {
    const style = document.createElement('style');
    style.id = 'critfail-shake-style';
    style.textContent = `
      @keyframes critfail-shake {
        0%, 100% { transform: translateX(0); }
        10% { transform: translateX(-8px) rotate(-1deg); }
        20% { transform: translateX(8px) rotate(1deg); }
        30% { transform: translateX(-6px) rotate(-0.5deg); }
        40% { transform: translateX(6px) rotate(0.5deg); }
        50% { transform: translateX(-4px); }
        60% { transform: translateX(4px); }
        70% { transform: translateX(-2px); }
        80% { transform: translateX(2px); }
      }
    `;
    document.head.appendChild(style);
  }
}

/** Blood drip + screen shake for a Natural 1 */
function triggerNat1Blood() {
  triggerScreenShake();

  // Brief red flash overlay
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed; inset: 0; z-index: 9998;
    background: radial-gradient(ellipse at top, rgba(139,0,0,0.4), transparent 70%);
    pointer-events: none;
    animation: critfail-flash 2s ease-out forwards;
  `;

  // Inject flash keyframes
  if (!document.getElementById('critfail-flash-style')) {
    const style = document.createElement('style');
    style.id = 'critfail-flash-style';
    style.textContent = `
      @keyframes critfail-flash {
        0% { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes blood-drip {
        0% { transform: translateY(-100%) scaleY(0.3); }
        30% { opacity: 1; }
        100% { transform: translateY(100vh) scaleY(1); }
      }
      @keyframes blood-fade {
        0% { opacity: 1; }
        60% { opacity: 0.8; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 2100);

  // Create blood drips — vertical streaks falling from top
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; height: 100vh;
    z-index: 9999; pointer-events: none; overflow: hidden;
  `;

  const dripCount = 35 + Math.floor(Math.random() * 15);
  for (let i = 0; i < dripCount; i++) {
    const drip = document.createElement('div');
    const left = Math.random() * 100;
    const width = 4 + Math.random() * 18; // 4-22px, some really thick
    const delay = Math.random() * 0.5;
    const duration = 3.0 + Math.random() * 2.5; // 3.0-5.5s — slow oozing drips
    const shade = Math.floor(80 + Math.random() * 60);
    const height = 20 + Math.random() * 50;

    drip.style.cssText = `
      position: absolute;
      top: 0;
      left: ${left}%;
      width: ${width}px;
      height: ${height}%;
      background: linear-gradient(to bottom,
        transparent 0%,
        rgba(${shade},0,0,0.3) 15%,
        rgba(${shade},0,0,0.7) 60%,
        rgba(${shade},0,0,0.95) 100%
      );
      border-radius: ${width}px;
      animation: blood-drip ${duration}s ${delay}s ease-in forwards,
                 blood-fade ${1.0 + Math.random() * 1.5}s ${delay + duration * 0.5 + Math.random() * 0.5}s ease-out forwards;
      transform: translateY(-100%);
    `;
    container.appendChild(drip);
  }

  document.body.appendChild(container);
  setTimeout(() => container.remove(), 9000);
}


export default function RandomGameView() {
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [isNat20, setIsNat20] = useState(false);
  const [isNat1, setIsNat1] = useState(false);
  const [type, setType] = useState<string | null>(null);
  const [activeSkin, setActiveSkin] = useState<DiceSkin>(getSkin(DEFAULT_SKIN_ID));
  const [skinReady, setSkinReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customSkins, setCustomSkins] = useState<CustomDiceSkinSummary[]>([]);

  // Load user's saved dice skin and custom skins on mount
  useEffect(() => {
    async function loadSkin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);

      if (user) {
        try {
          // Load saved skin preference + custom skins in parallel
          const [skinRes, customRes] = await Promise.all([
            fetch('/api/user/dice-skin'),
            fetch('/api/dice-skins'),
          ]);

          if (customRes.ok) {
            const { skins } = await customRes.json();
            setCustomSkins(skins ?? []);
          }

          if (skinRes.ok) {
            const data = await skinRes.json();
            if (data.customSkin) {
              // Custom skin — resolve from config
              setActiveSkin(resolveCustomSkin(
                data.customSkin.id,
                data.customSkin.name,
                data.customSkin.emoji,
                data.customSkin.config,
              ));
            } else {
              setActiveSkin(getSkin(data.skinId));
            }
          }
        } catch {
          // Fall back to default skin silently
        }
      }
      // Always mark ready — logged-out users just get the default skin immediately
      setSkinReady(true);
    }
    loadSkin();
  }, []);

  // Handle skin selection — save to server if logged in
  function handleSkinSelect(skin: DiceSkin) {
    setActiveSkin(skin);
    if (isLoggedIn) {
      fetch('/api/user/dice-skin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skinId: skin.id }),
      }).catch(() => {
        // Silently fail — local state already updated
      });
    }
  }

  async function rollDice() {
    if (rolling) return;
    setRolling(true);
    setLoading(true);
    setDiceValue(null);
    setIsNat20(false);
    setIsNat1(false);

    // Try up to 3 times to get a random game
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const params = type ? `?type=${type}` : '';
        const res = await fetch(`/api/games/random${params}`);
        if (res.ok) {
          const data = await res.json();
          if (data.game) {
            setGame(data.game);
            break;
          }
        }
        // If failed, wait a bit before retrying
        if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
      } catch {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
      }
    }
    setLoading(false);
  }

  const { unlock } = useAchievements();

  // Dice achievement tracking
  const rollHistory = useRef<number[]>([]);
  const rollTimestamps = useRef<number[]>([]);
  const totalRolls = useRef(0);

  const handleDiceSettled = useCallback((value: number) => {
    setDiceValue(value);
    setRolling(false);

    unlock('first_roll');
    totalRolls.current++;

    // Track roll history for streak achievements
    rollHistory.current.push(value);
    rollTimestamps.current.push(Date.now());

    // Natural 20 / Natural 1
    if (value === 20) {
      setIsNat20(true);
      triggerEpicNat20();
      unlock('natural_20');
    } else if (value === 1) {
      setIsNat1(true);
      triggerNat1Blood();
      unlock('natural_1');
    }

    // Lucky Streak: 15+ three times in a row
    const h = rollHistory.current;
    if (h.length >= 3) {
      const last3 = h.slice(-3);
      if (last3.every((v) => v >= 15)) unlock('lucky_streak');
    }

    // Snake Eyes: 1 twice in a row
    if (h.length >= 2 && h[h.length - 1] === 1 && h[h.length - 2] === 1) {
      unlock('snake_eyes');
    }

    // Double Down: same number twice in a row
    if (h.length >= 2 && h[h.length - 1] === h[h.length - 2]) {
      unlock('double_down');
    }

    // Century Club: 100 total rolls
    if (totalRolls.current >= 100) unlock('century_club');

    // Speed Demon: 5 rolls within 60 seconds
    const ts = rollTimestamps.current;
    if (ts.length >= 5) {
      const last5 = ts.slice(-5);
      if (last5[4] - last5[0] < 60000) unlock('speed_demon');
    }
  }, [unlock]);

  const typeOptions = [
    { label: 'Any Game', value: null, icon: <Dice5 size={14} /> },
    { label: 'Board Game', value: 'board', icon: <Puzzle size={14} /> },
    { label: 'Video Game', value: 'video', icon: <Gamepad2 size={14} /> },
    { label: 'Word Game', value: 'word', icon: <Type size={14} /> },
    { label: 'Party Game', value: 'party', icon: <PartyPopper size={14} /> },
  ];

  return (
    <Container maxWidth="md" sx={{
      py: 4,
      textAlign: 'center',
      minHeight: '100vh',
      position: 'relative',
      ...(isNat20 ? {
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.08), transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'nat20-bg-fade 4s ease-out forwards',
          '@keyframes nat20-bg-fade': {
            '0%': { opacity: 1 },
            '100%': { opacity: 0 },
          },
        },
      } : {}),
    }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Random Game Picker',
        url: 'https://boredgame.lol/random',
        applicationCategory: 'Entertainment',
        operatingSystem: 'Web',
        description: 'Roll the dice and discover a random board game, video game, or word game. Filter by type and let fate decide your next game night.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }} />
      <Stack spacing={3} alignItems="center">
        <Box>
          <Typography variant="h3" fontWeight={800} sx={{ mb: 1 }}>
            Roll the Dice
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Not sure what to play? Let fate decide.
          </Typography>
        </Box>

        {/* Dice + Customizer — side-by-side on desktop, stacked on mobile */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 2, md: 3 },
            width: '100%',
          }}
        >
          {/* Desktop: vertical customizer to the left */}
          <Box sx={{ display: { xs: 'none', md: 'block' }, flexShrink: 0 }}>
            <DiceCustomizer
              activeSkinId={activeSkin.id}
              isLoggedIn={isLoggedIn}
              onSelect={handleSkinSelect}
              customSkins={customSkins}
              vertical
            />
          </Box>

          {/* 3D Physics Dice — hidden until skin is resolved to avoid flash */}
          <Box sx={{ width: '100%', maxWidth: 400 }} onClick={() => !rolling && rollDice()}>
            {skinReady ? (
              <PhysicsDice
                rolling={rolling}
                onSettled={handleDiceSettled}
                skin={activeSkin}
                isNat20={isNat20}
              />
            ) : (
              <Box sx={{ width: '100%', height: 300 }} />
            )}
          </Box>
        </Box>

        {/* Mobile: horizontal customizer below the dice */}
        <Box sx={{ display: { xs: 'block', md: 'none' }, width: '100%' }}>
          <DiceCustomizer
            activeSkinId={activeSkin.id}
            isLoggedIn={isLoggedIn}
            onSelect={handleSkinSelect}
            customSkins={customSkins}
          />
        </Box>

        {/* Dice links */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 1 }}>
          <Button size="small" variant="outlined" onClick={() => router.push('/dice-creator')} sx={{ textTransform: 'none' }}>
            Create a Skin
          </Button>
          <Button size="small" variant="outlined" onClick={() => router.push('/dice-gallery')} sx={{ textTransform: 'none' }}>
            Dice Gallery
          </Button>
        </Box>

        {/* Dice result */}
        <AnimatePresence mode="wait">
          {diceValue && !rolling && (
            <motion.div
              key={`dice-${diceValue}-${isNat20}-${isNat1}`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              style={{ marginTop: 8 }}
          >
              {isNat20 ? (
                <Box>
                  <motion.div
                    initial={{ scale: 3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15, duration: 0.6 }}
                  >
                    <Typography
                      variant="h3"
                      fontWeight={900}
                      sx={{
                        background: 'linear-gradient(135deg, #FFD700, #FF6D3F, #FF4081, #FFD700)',
                        backgroundSize: '200% 200%',
                        animation: 'shimmer 1.5s ease infinite',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0 0 30px rgba(255,215,0,0.4), 0 0 60px rgba(255,215,0,0.2)',
                        filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.5))',
                        '@keyframes shimmer': {
                          '0%': { backgroundPosition: '0% 50%' },
                          '50%': { backgroundPosition: '100% 50%' },
                          '100%': { backgroundPosition: '0% 50%' },
                        },
                      }}
                    >
                      NATURAL 20!
                    </Typography>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 12 }}
                  >
                    <Typography variant="h5" fontWeight={700} sx={{ color: 'warning.main', mt: 1 }}>
                      CRITICAL SUCCESS!
                    </Typography>
                  </motion.div>
                </Box>
              ) : isNat1 ? (
                <Box>
                  <motion.div
                    animate={{ x: [0, -3, 3, -2, 2, 0] }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  >
                    <Typography
                      variant="h3"
                      fontWeight={900}
                      sx={{
                        color: '#8B0000',
                        textShadow: '0 0 20px rgba(139,0,0,0.4), 0 0 40px rgba(139,0,0,0.2)',
                      }}
                    >
                      NATURAL 1...
                    </Typography>
                  </motion.div>
                  <Typography variant="h5" fontWeight={700} sx={{ color: 'error.main', mt: 1 }}>
                    CRITICAL FAILURE!
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                    The dice gods have forsaken you. Roll again?
                  </Typography>
                </Box>
              ) : (
                <Typography variant="h5" fontWeight={700} sx={{ color: 'secondary.main' }}>
                  You rolled {diceValue === 8 || diceValue === 11 || diceValue === 18 ? 'an' : 'a'} {diceValue}!
                </Typography>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Type filter chips */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mt: "16px !important" }}>
          {typeOptions.map((opt) => (
            <Chip
              key={opt.label}
              icon={opt.icon as React.ReactElement}
              label={opt.label}
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
            disabled={rolling}
            sx={{ px: 6, py: 2, fontSize: '1.2rem', borderRadius: 3 }}
          >
            {rolling ? 'Rolling...' : game ? 'Roll Again' : 'Roll!'}
          </Button>
        </motion.div>

        {/* Result */}
        <AnimatePresence mode="wait">
          {game && !rolling && (
            <motion.div
              key={(game as any).id ?? 'result'}
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
                  ...(isNat20 ? {
                    border: '2px solid',
                    borderColor: 'warning.main',
                    boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
                  } : isNat1 ? {
                    border: '2px solid',
                    borderColor: 'error.main',
                    boxShadow: '0 0 20px rgba(139, 0, 0, 0.3)',
                  } : {}),
                }}
                onClick={() => router.push(`/games/${encodeURIComponent((game as any).id)}`)}
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
                  {isNat20 && (
                    <Typography
                      variant="overline"
                      sx={{ color: 'warning.main', fontWeight: 700, letterSpacing: 2 }}
                    >
                      Critical Success
                    </Typography>
                  )}
                  {isNat1 && (
                    <Typography
                      variant="overline"
                      sx={{ color: 'error.main', fontWeight: 700, letterSpacing: 2 }}
                    >
                      Critical Failure
                    </Typography>
                  )}
                  <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                    {(game as any).name}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, justifyContent: 'center' }}>
                    {(game as any).rating && (
                      <Chip
                        label={<AnimatedRating value={Number((game as any).rating)} prefix="⭐ " delay={500} />}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                    {(game as any).min_players && (
                      <Chip
                        icon={<Users size={14} /> as React.ReactElement}
                        label={`${(game as any).min_players}${(game as any).max_players && (game as any).max_players !== (game as any).min_players ? `–${(game as any).max_players}` : ''} players`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {(game as any).avg_play_time && (
                      <Chip
                        icon={<Clock size={14} /> as React.ReactElement}
                        label={`${(game as any).avg_play_time} min`}
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
                      router.push(`/games/${encodeURIComponent((game as any).id)}`);
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
