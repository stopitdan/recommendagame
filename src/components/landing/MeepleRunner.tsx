'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { useTheme, alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Ball Runner — side-scroller game at the bottom of the landing page.
 *
 * A squishy ball bounces over stalagmites (ground spikes) and ducks
 * under stalactites (ceiling spikes). The ball squishes on landing,
 * stretches when jumping, and has a trail effect.
 *
 * Click "Start Game" to play. SPACE/UP = jump, DOWN = duck.
 * Score ticks up over time. High score persisted to localStorage.
 */

const HISCORE_KEY = 'rag_runner_hiscore';

// ─── Tuning ──────────────────────────────────────────────────

const GROUND_Y = 28;
const BALL_RADIUS = 10;
const GRAVITY = 0.38;
const JUMP_FORCE = -8;
const DUCK_SQUISH = 0.4; // how flat the ball gets when ducking

const INITIAL_SPEED = 1.5;
const MAX_SPEED = 5;
const SPEED_INCREMENT = 0.0006;

const GAP_MIN = 110;
const GAP_MAX = 300;

// ─── Types ───────────────────────────────────────────────────

interface Spike {
  x: number;
  type: 'ground' | 'ceiling';
  width: number;
  height: number;
}

// ─── Component ───────────────────────────────────────────────

export default function MeepleRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  const gameState = useRef<'idle' | 'playing' | 'dead'>('idle');
  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const ballY = useRef(0);
  const ballVY = useRef(0);
  const isDucking = useRef(false);
  const spikes = useRef<Spike[]>([]);
  const frameCount = useRef(0);
  const nextSpikeIn = useRef(150);
  const squishFactor = useRef(1); // 1 = normal, <1 = squished, >1 = stretched

  const [uiState, setUiState] = useState<'idle' | 'playing' | 'dead'>('idle');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayHi, setDisplayHi] = useState(0);

  // Load high score
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISCORE_KEY);
      if (saved) {
        highScoreRef.current = parseInt(saved, 10) || 0;
        setDisplayHi(highScoreRef.current);
      }
    } catch {}
  }, []);

  const startGame = useCallback(() => {
    gameState.current = 'playing';
    setUiState('playing');
    scoreRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    ballY.current = 0;
    ballVY.current = 0;
    isDucking.current = false;
    spikes.current = [];
    frameCount.current = 0;
    nextSpikeIn.current = 150;
    squishFactor.current = 1;
    setDisplayScore(0);
  }, []);

  const die = useCallback(() => {
    gameState.current = 'dead';
    setUiState('dead');
    setDisplayScore(scoreRef.current);
    if (scoreRef.current > highScoreRef.current) {
      highScoreRef.current = scoreRef.current;
      setDisplayHi(highScoreRef.current);
      try { localStorage.setItem(HISCORE_KEY, String(highScoreRef.current)); } catch {}
    }
  }, []);

  const jump = useCallback(() => {
    if (ballY.current <= 0.5) {
      ballVY.current = JUMP_FORCE;
      squishFactor.current = 1.3; // stretch on jump
    }
  }, []);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (gameState.current !== 'playing') {
        if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); startGame(); }
        return;
      }
      if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); jump(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); isDucking.current = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') isDucking.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [startGame, jump]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
    };
    resize();
    window.addEventListener('resize', resize);
    let animId: number;

    const loop = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { animId = requestAnimationFrame(loop); return; }

      const w = canvas.width / 2;
      const h = canvas.height / 2;
      ctx.save();
      ctx.scale(2, 2);
      ctx.clearRect(0, 0, w, h);

      const groundY = h - GROUND_Y;
      const ballX = 60;

      // Ground line
      ctx.strokeStyle = alpha(theme.palette.divider, 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(w, groundY);
      ctx.stroke();

      // ─── Update ───
      if (gameState.current === 'playing') {
        frameCount.current++;
        speedRef.current = Math.min(MAX_SPEED, speedRef.current + SPEED_INCREMENT);
        scoreRef.current = Math.floor(frameCount.current / 10);

        // Update score display every 10 frames
        if (frameCount.current % 10 === 0) setDisplayScore(scoreRef.current);

        // Physics
        ballVY.current += GRAVITY;
        ballY.current -= ballVY.current;

        if (ballY.current < 0) {
          ballY.current = 0;
          ballVY.current = 0;
          squishFactor.current = 0.6; // squish on land
        }

        // Squish recovery (spring back to 1.0)
        squishFactor.current += (1 - squishFactor.current) * 0.12;

        // Duck
        if (isDucking.current && ballY.current <= 0.5) {
          squishFactor.current = DUCK_SQUISH;
        }

        // Spawn spikes
        nextSpikeIn.current--;
        if (nextSpikeIn.current <= 0) {
          // 70% ground spikes, 30% ceiling (only after score 20)
          const isCeiling = Math.random() < 0.3 && scoreRef.current > 20;
          const spikeH = isCeiling
            ? 18 + Math.random() * 14 // ceiling: 18-32px tall
            : 14 + Math.random() * 16; // ground: 14-30px tall

          spikes.current.push({
            x: w + 20,
            type: isCeiling ? 'ceiling' : 'ground',
            width: 10 + Math.random() * 8,
            height: spikeH,
          });

          nextSpikeIn.current = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
        }

        // Move spikes
        for (const s of spikes.current) s.x -= speedRef.current;
        spikes.current = spikes.current.filter((s) => s.x > -30);

        // Collision
        const bEffectiveR = BALL_RADIUS * (isDucking.current ? DUCK_SQUISH : 1);
        const bBottom = ballY.current;
        const bTop = ballY.current + bEffectiveR * 2;

        for (const s of spikes.current) {
          const sLeft = s.x;
          const sRight = s.x + s.width;
          let sBottom: number, sTop: number;

          if (s.type === 'ground') {
            sBottom = 0;
            sTop = s.height;
          } else {
            // Ceiling spike hangs from top of play area
            sTop = groundY; // visual top
            sBottom = groundY - s.height;
            // Convert to ball coordinate space (ball Y is offset from ground)
            const ceilHitBottom = (groundY - s.height) - (groundY - GROUND_Y);
            const ceilHitTop = GROUND_Y;
            if (
              ballX + BALL_RADIUS > sLeft &&
              ballX - BALL_RADIUS < sRight &&
              bTop > (GROUND_Y - s.height) &&
              bBottom < GROUND_Y
            ) {
              die();
              break;
            }
            continue;
          }

          // Ground spike collision
          if (
            ballX + BALL_RADIUS > sLeft &&
            ballX - BALL_RADIUS < sRight &&
            bBottom < sTop
          ) {
            die();
            break;
          }
        }
      }

      // ─── Draw ───

      // Draw spikes
      for (const s of spikes.current) {
        ctx.fillStyle = alpha(theme.palette.text.primary, 0.6);

        if (s.type === 'ground') {
          // Triangle pointing up (stalagmite)
          ctx.beginPath();
          ctx.moveTo(s.x, groundY);
          ctx.lineTo(s.x + s.width / 2, groundY - s.height);
          ctx.lineTo(s.x + s.width, groundY);
          ctx.closePath();
          ctx.fill();
        } else {
          // Triangle pointing down (stalactite) from ceiling
          const ceilY = groundY - GROUND_Y - 10; // top of play area
          ctx.beginPath();
          ctx.moveTo(s.x, ceilY);
          ctx.lineTo(s.x + s.width / 2, ceilY + s.height);
          ctx.lineTo(s.x + s.width, ceilY);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Draw ball with squish
      const drawY = groundY - ballY.current;
      const sq = squishFactor.current;
      const rx = BALL_RADIUS * (1 / sq); // wider when squished
      const ry = BALL_RADIUS * sq; // shorter when squished

      // Ball shadow
      ctx.fillStyle = alpha(theme.palette.text.primary, 0.08);
      ctx.beginPath();
      ctx.ellipse(ballX, groundY + 2, rx * 0.8, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ball body
      const ballGrad = ctx.createRadialGradient(
        ballX - rx * 0.3, drawY - ry * 0.3, 0,
        ballX, drawY, rx,
      );
      ballGrad.addColorStop(0, theme.palette.secondary.main);
      ballGrad.addColorStop(1, theme.palette.secondary.dark ?? theme.palette.secondary.main);

      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.ellipse(ballX, drawY - ry, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ball highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.ellipse(ballX - rx * 0.25, drawY - ry * 1.3, rx * 0.3, ry * 0.25, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Ball eye (cute!)
      if (gameState.current !== 'dead') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ballX + rx * 0.25, drawY - ry * 1.1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme.palette.text.primary;
        ctx.beginPath();
        ctx.arc(ballX + rx * 0.35, drawY - ry * 1.1, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // X eyes when dead
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        const ex = ballX + rx * 0.2;
        const ey = drawY - ry * 1.1;
        ctx.beginPath();
        ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2);
        ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2);
        ctx.stroke();
      }

      ctx.restore();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [theme, die]);

  return (
    <Box
      sx={{
        position: uiState === 'playing' ? 'fixed' : 'relative',
        bottom: uiState === 'playing' ? 0 : 'auto',
        left: 0,
        right: 0,
        height: { xs: 90, md: 100 },
        zIndex: uiState === 'playing' ? 50 : 1,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.default, uiState === 'playing' ? 0.95 : 0.7),
        backdropFilter: uiState === 'playing' ? 'blur(12px)' : 'blur(4px)',
        overflow: 'hidden',
      }}
    >
      {/* Canvas (always renders) */}
      <canvas
        ref={canvasRef}
        onClick={() => { if (uiState === 'playing') jump(); }}
        onTouchStart={() => { if (uiState === 'playing') jump(); }}
        style={{ width: '100%', height: '100%', display: 'block', cursor: uiState === 'playing' ? 'pointer' : 'default' }}
      />

      {/* Overlay UI for idle/dead states */}
      <AnimatePresence>
        {uiState !== 'playing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
            }}
          >
            <Stack direction="row" spacing={3} alignItems="center">
              {uiState === 'dead' && (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Score: {displayScore}
                </Typography>
              )}

              <Button
                variant="outlined"
                size="small"
                onClick={startGame}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  borderColor: 'secondary.main',
                  color: 'secondary.main',
                  '&:hover': { borderColor: 'secondary.dark', bgcolor: alpha(theme.palette.secondary.main, 0.08) },
                }}
              >
                {uiState === 'dead' ? 'Play Again' : 'Start Game'}
              </Button>

              {displayHi > 0 && (
                <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 500 }}>
                  Best: {displayHi}
                </Typography>
              )}

              {uiState === 'idle' && (
                <Typography variant="caption" sx={{ color: 'text.disabled', display: { xs: 'none', md: 'block' } }}>
                  ↑ Jump · ↓ Duck
                </Typography>
              )}
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score display during gameplay */}
      {uiState === 'playing' && (
        <Box sx={{ position: 'absolute', top: 8, right: 16, zIndex: 5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.85rem' }}>
            {String(displayScore).padStart(5, '0')}
          </Typography>
          {displayHi > 0 && (
            <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.65rem' }}>
              HI {String(displayHi).padStart(5, '0')}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
