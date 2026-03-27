'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { useTheme, alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Ball Runner — Chrome Dino-style side-scroller.
 * Fixed to bottom of viewport only during active play.
 */

const HISCORE_KEY = 'rag_runner_hiscore';

// ─── Tuning ──────────────────────────────────────────────────

const GROUND_FROM_BOTTOM = 20; // ground line px from canvas bottom
const BALL_R = 9;
const GRAVITY = 0.35;
const JUMP_VEL = -7.5;
const INITIAL_SPEED = 1.4;
const MAX_SPEED = 4.5;
const SPEED_INC = 0.0005;
const GAP_MIN = 120;
const GAP_MAX = 320;

interface Spike {
  x: number;
  ground: boolean; // true = stalagmite, false = stalactite
  w: number;
  h: number;
}

export default function MeepleRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  // All game state in refs for perf
  const state = useRef<'idle' | 'playing' | 'dead'>('idle');
  const score = useRef(0);
  const hiScore = useRef(0);
  const speed = useRef(INITIAL_SPEED);
  const by = useRef(0); // ball Y above ground
  const bvy = useRef(0);
  const ducking = useRef(false);
  const wasAirborne = useRef(false); // track if we were in the air (for squish)
  const squish = useRef(1); // 1=normal, <1=flat, >1=tall
  const spikes = useRef<Spike[]>([]);
  const frame = useRef(0);
  const nextSpike = useRef(160);

  const [ui, setUi] = useState<'idle' | 'playing' | 'dead'>('idle');
  const [uiScore, setUiScore] = useState(0);
  const [uiHi, setUiHi] = useState(0);

  useEffect(() => {
    try {
      const s = localStorage.getItem(HISCORE_KEY);
      if (s) { hiScore.current = parseInt(s, 10) || 0; setUiHi(hiScore.current); }
    } catch {}
  }, []);

  const start = useCallback(() => {
    state.current = 'playing'; setUi('playing');
    score.current = 0; speed.current = INITIAL_SPEED;
    by.current = 0; bvy.current = 0;
    ducking.current = false; wasAirborne.current = false;
    squish.current = 1; spikes.current = [];
    frame.current = 0; nextSpike.current = 160;
    setUiScore(0);
  }, []);

  const die = useCallback(() => {
    state.current = 'dead'; setUi('dead');
    setUiScore(score.current);
    if (score.current > hiScore.current) {
      hiScore.current = score.current;
      setUiHi(hiScore.current);
      try { localStorage.setItem(HISCORE_KEY, String(hiScore.current)); } catch {}
    }
  }, []);

  const jump = useCallback(() => {
    if (by.current < 1) {
      bvy.current = JUMP_VEL;
      squish.current = 1.25; // stretch up on jump
    }
  }, []);

  // Keys
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (state.current !== 'playing') {
        if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); start(); }
        return;
      }
      if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); jump(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); ducking.current = true; }
    };
    const ku = (e: KeyboardEvent) => { if (e.key === 'ArrowDown') ducking.current = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [start, jump]);

  const interact = useCallback(() => {
    if (state.current !== 'playing') start(); else jump();
  }, [start, jump]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    let anim: number;

    const loop = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { anim = requestAnimationFrame(loop); return; }

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const gndY = h - GROUND_FROM_BOTTOM; // ground line Y
      const ballX = 55;
      const playH = gndY - 8; // playable height (top of area)

      // Ground line
      ctx.strokeStyle = alpha(theme.palette.divider, 0.2);
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(0, gndY); ctx.lineTo(w, gndY); ctx.stroke();
      ctx.setLineDash([]);

      // ─── Update ───
      if (state.current === 'playing') {
        frame.current++;
        speed.current = Math.min(MAX_SPEED, speed.current + SPEED_INC);
        score.current = Math.floor(frame.current / 10);
        if (frame.current % 10 === 0) setUiScore(score.current);

        // Physics
        const wasInAir = by.current > 1;
        bvy.current += GRAVITY;
        by.current -= bvy.current;
        if (by.current < 0) {
          by.current = 0;
          bvy.current = 0;
          // Only squish on LANDING (was in air, now on ground)
          if (wasInAir) {
            squish.current = 0.55;
          }
        }

        // Track airborne state
        wasAirborne.current = by.current > 1;

        // Squish spring recovery
        squish.current += (1 - squish.current) * 0.1;

        // Ducking: flatten only when on ground
        if (ducking.current && by.current < 1) squish.current = 0.45;

        // Spawn spikes
        nextSpike.current--;
        if (nextSpike.current <= 0) {
          const isCeiling = Math.random() < 0.25 && score.current > 25;
          spikes.current.push({
            x: w + 20,
            ground: !isCeiling,
            w: 8 + Math.random() * 8,
            h: isCeiling
              ? 12 + Math.random() * 10 // ceiling: 12-22px (not too low)
              : 12 + Math.random() * 14, // ground: 12-26px
          });
          nextSpike.current = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
        }

        // Move + cull spikes
        for (const s of spikes.current) s.x -= speed.current;
        spikes.current = spikes.current.filter((s) => s.x > -30);

        // Collision
        const effectiveH = BALL_R * 2 * Math.min(squish.current, 1);
        const bBot = by.current;
        const bTop = by.current + effectiveH;

        for (const s of spikes.current) {
          if (ballX + BALL_R < s.x || ballX - BALL_R > s.x + s.w) continue;

          if (s.ground) {
            // Ground spike: bottom=0, top=height
            if (bBot < s.h) { die(); break; }
          } else {
            // Ceiling spike: hangs from top, tip at (playH - gndY + s.h) from ground
            // In ball coords: spike occupies from (gndY - 8 - s.h) to top
            const spikeBottomFromGround = (gndY - 8) - s.h;
            // Convert to ball coordinate (ball Y is distance above ground)
            const spikeTip = spikeBottomFromGround;
            if (bTop > spikeTip) { die(); break; }
          }
        }
      }

      // ─── Draw ───

      // Spikes
      for (const s of spikes.current) {
        ctx.fillStyle = alpha(theme.palette.text.primary, 0.55);
        if (s.ground) {
          ctx.beginPath();
          ctx.moveTo(s.x, gndY);
          ctx.lineTo(s.x + s.w / 2, gndY - s.h);
          ctx.lineTo(s.x + s.w, gndY);
          ctx.closePath(); ctx.fill();
        } else {
          // Ceiling: hangs from top of play area
          const topY = 8;
          ctx.beginPath();
          ctx.moveTo(s.x, topY);
          ctx.lineTo(s.x + s.w / 2, topY + s.h);
          ctx.lineTo(s.x + s.w, topY);
          ctx.closePath(); ctx.fill();
        }
      }

      // Ball
      const drawY = gndY - by.current;
      const sq = squish.current;
      const rx = BALL_R * (2 - sq); // wider when squished
      const ry = BALL_R * sq;

      // Shadow
      ctx.fillStyle = alpha(theme.palette.text.primary, 0.06);
      ctx.beginPath();
      ctx.ellipse(ballX, gndY + 1, rx * 0.7, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body gradient
      const grad = ctx.createRadialGradient(
        ballX - rx * 0.25, drawY - ry * 0.3, 0,
        ballX, drawY, Math.max(rx, ry),
      );
      grad.addColorStop(0, theme.palette.secondary.main);
      grad.addColorStop(1, theme.palette.secondary.dark ?? theme.palette.secondary.main);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(ballX, drawY - ry, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(ballX - rx * 0.2, drawY - ry * 1.2, rx * 0.25, ry * 0.2, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      if (state.current !== 'dead') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ballX + rx * 0.3, drawY - ry, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme.palette.text.primary;
        ctx.beginPath();
        ctx.arc(ballX + rx * 0.4, drawY - ry, 1.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = theme.palette.text.primary;
        ctx.lineWidth = 1.2;
        const ex = ballX + rx * 0.3, ey = drawY - ry;
        ctx.beginPath();
        ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2);
        ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2);
        ctx.stroke();
      }

      anim = requestAnimationFrame(loop);
    };

    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); };
  }, [theme, die]);

  return (
    <Box
      sx={{
        position: ui === 'playing' ? 'fixed' : 'relative',
        bottom: ui === 'playing' ? 0 : 'auto',
        left: 0, right: 0,
        height: { xs: 80, md: 90 },
        zIndex: ui === 'playing' ? 50 : 1,
        borderTop: '1px solid', borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.default, ui === 'playing' ? 0.95 : 0.7),
        backdropFilter: ui === 'playing' ? 'blur(12px)' : 'blur(4px)',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={() => ui === 'playing' && jump()}
        onTouchStart={() => ui === 'playing' && jump()}
        style={{ width: '100%', height: '100%', display: 'block', cursor: ui === 'playing' ? 'pointer' : 'default' }}
      />

      {/* Overlay UI */}
      <AnimatePresence>
        {ui !== 'playing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 5,
              background: alpha(theme.palette.background.default, 0.4),
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              {ui === 'dead' && (
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                  Score: {uiScore}
                </Typography>
              )}

              <Button
                variant="contained"
                size="small"
                onClick={start}
                sx={{
                  borderRadius: 2, px: 3, py: 0.8,
                  fontWeight: 700, fontSize: '0.85rem',
                }}
              >
                {ui === 'dead' ? 'Play Again' : 'Start Game'}
              </Button>

              {uiHi > 0 && (
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  Best: {uiHi}
                </Typography>
              )}

              {ui === 'idle' && (
                <Typography variant="caption" sx={{ color: 'text.disabled', display: { xs: 'none', md: 'block' } }}>
                  SPACE to jump · DOWN to duck
                </Typography>
              )}
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score HUD during gameplay */}
      {ui === 'playing' && (
        <Box sx={{ position: 'absolute', top: 6, right: 14, zIndex: 5 }}>
          <Typography sx={{ fontWeight: 700, color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.85rem' }}>
            {String(uiScore).padStart(5, '0')}
          </Typography>
          {uiHi > 0 && (
            <Typography sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.6rem' }}>
              HI {String(uiHi).padStart(5, '0')}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
