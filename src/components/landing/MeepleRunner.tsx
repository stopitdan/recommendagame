'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { useTheme, alpha } from '@mui/material/styles';

/**
 * Ball Runner — Chrome Dino clone.
 *
 * Replicates Chrome Dino physics exactly:
 * - Tap/SPACE = jump. HOLD for higher/longer jump.
 * - DOWN = duck under ceiling spikes.
 * - Speed increases over time. Score increments.
 *
 * The key Chrome Dino mechanic: holding the jump button applies
 * REDUCED gravity while the ball is rising, so you stay in the
 * air longer. Short tap = low hop. Long hold = high arc.
 */

const LS_KEY = 'rag_runner_hi';

// Chrome Dino-accurate physics (scaled for our smaller canvas)
const JUMP_VEL = -10;
const GRAVITY = 0.6;
const GRAVITY_HOLD = 0.25; // while jump held + rising = float longer
const SPEED_INIT = 2.5;
const SPEED_MAX = 6;
const SPEED_INC = 0.001;
const GROUND_PAD = 18; // ground line from bottom
const BALL_R = 8;

interface Spike { x: number; ground: boolean; w: number; h: number; }

export default function MeepleRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  // Game state (refs for animation loop perf)
  const gs = useRef<'idle' | 'play' | 'dead'>('idle');
  const sc = useRef(0);
  const hi = useRef(0);
  const spd = useRef(SPEED_INIT);
  const by = useRef(0);
  const bvy = useRef(0);
  const duck = useRef(false);
  const holdJump = useRef(false);
  const squish = useRef(1);
  const wasAir = useRef(false);
  const spikes = useRef<Spike[]>([]);
  const fr = useRef(0);
  const nextGap = useRef(100);

  // UI state (triggers React re-renders for overlay)
  const [uiState, setUiState] = useState<'idle' | 'play' | 'dead'>('idle');
  const [uiScore, setUiScore] = useState(0);
  const [uiHi, setUiHi] = useState(0);

  // Load hi score
  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem(LS_KEY) ?? '0', 10);
      if (v > 0) { hi.current = v; setUiHi(v); }
    } catch {}
  }, []);

  const startGame = useCallback(() => {
    gs.current = 'play'; setUiState('play');
    sc.current = 0; spd.current = SPEED_INIT;
    by.current = 0; bvy.current = 0;
    duck.current = false; holdJump.current = false;
    squish.current = 1; wasAir.current = false;
    spikes.current = []; fr.current = 0;
    nextGap.current = 100; setUiScore(0);
  }, []);

  const die = useCallback(() => {
    gs.current = 'dead'; setUiState('dead');
    setUiScore(sc.current);
    if (sc.current > hi.current) {
      hi.current = sc.current; setUiHi(sc.current);
      try { localStorage.setItem(LS_KEY, String(sc.current)); } catch {}
    }
  }, []);

  const jump = useCallback(() => {
    if (by.current < 0.5) { // on ground
      bvy.current = JUMP_VEL;
      squish.current = 1.3; // stretch on launch
      holdJump.current = true;
    }
  }, []);

  const releaseJump = useCallback(() => { holdJump.current = false; }, []);

  // Keyboard
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.repeat) return; // ignore key repeat — only first press triggers jump
      const k = e.key;
      if (gs.current !== 'play') {
        if (k === ' ' || k === 'ArrowUp') { e.preventDefault(); startGame(); }
        return;
      }
      if (k === ' ' || k === 'ArrowUp') { e.preventDefault(); jump(); }
      if (k === 'ArrowDown') { e.preventDefault(); duck.current = true; }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') duck.current = false;
      if (e.key === ' ' || e.key === 'ArrowUp') releaseJump();
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [startGame, jump, releaseJump]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      canvas.width = r.width * d; canvas.height = r.height * d;
    };
    resize();
    window.addEventListener('resize', resize);
    let anim: number;

    const loop = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { anim = requestAnimationFrame(loop); return; }
      const d = window.devicePixelRatio || 1;
      const w = canvas.width / d;
      const h = canvas.height / d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const gnd = h - GROUND_PAD;
      const bx = 50;
      const playTop = 6;

      // Ground line
      ctx.strokeStyle = alpha(theme.palette.divider, 0.25);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, gnd); ctx.lineTo(w, gnd); ctx.stroke();
      ctx.setLineDash([]);

      // ── UPDATE ──
      if (gs.current === 'play') {
        fr.current++;
        spd.current = Math.min(SPEED_MAX, spd.current + SPEED_INC);
        sc.current = Math.floor(fr.current / 8);
        if (fr.current % 8 === 0) setUiScore(sc.current);

        // Chrome Dino physics: reduced gravity while holding jump AND rising
        const airBefore = by.current > 0.5;
        const grav = (holdJump.current && bvy.current < 0) ? GRAVITY_HOLD : GRAVITY;
        bvy.current += grav;
        by.current -= bvy.current;

        // Ground
        if (by.current < 0) {
          by.current = 0; bvy.current = 0;
          if (airBefore) squish.current = 0.5; // squish on land
        }
        // Ceiling cap
        const maxH = gnd - playTop - BALL_R * 2;
        if (by.current > maxH) { by.current = maxH; if (bvy.current < 0) bvy.current = 0; }

        wasAir.current = by.current > 0.5;

        // Squish spring
        squish.current += (1 - squish.current) * 0.12;
        if (duck.current && by.current < 1) squish.current = 0.4;

        // Spawn spikes
        nextGap.current -= spd.current;
        if (nextGap.current <= 0) {
          const ceil = Math.random() < 0.2 && sc.current > 30;
          const playArea = gnd - playTop;
          spikes.current.push({
            x: w + 10,
            ground: !ceil,
            w: 8 + Math.random() * 6,
            h: ceil
              ? playArea * (0.5 + Math.random() * 0.2) // ceiling: hangs 50-70% down
              : 10 + Math.random() * (BALL_R * 2.5),   // ground: 10 to ~30px
          });
          nextGap.current = 80 + Math.random() * 200; // px gap (not frames)
        }

        // Move spikes
        for (const s of spikes.current) s.x -= spd.current;
        spikes.current = spikes.current.filter(s => s.x > -20);

        // Collision
        const effH = BALL_R * 2 * Math.min(squish.current, 1);
        for (const s of spikes.current) {
          if (bx + BALL_R < s.x || bx - BALL_R > s.x + s.w) continue;
          if (s.ground) {
            if (by.current < s.h) { die(); break; }
          } else {
            // Ceiling spike tip is at playTop + s.h (screen coords)
            // In ball-Y coords (distance above ground): gnd - (playTop + s.h)
            const tipBallY = gnd - playTop - s.h;
            if (by.current + effH > tipBallY) { die(); break; }
          }
        }
      }

      // ── DRAW ──

      // Spikes
      ctx.fillStyle = alpha(theme.palette.text.primary, 0.5);
      for (const s of spikes.current) {
        ctx.beginPath();
        if (s.ground) {
          ctx.moveTo(s.x, gnd);
          ctx.lineTo(s.x + s.w / 2, gnd - s.h);
          ctx.lineTo(s.x + s.w, gnd);
        } else {
          ctx.moveTo(s.x, playTop);
          ctx.lineTo(s.x + s.w / 2, playTop + s.h);
          ctx.lineTo(s.x + s.w, playTop);
        }
        ctx.closePath(); ctx.fill();
      }

      // Ball
      const drawY = gnd - by.current;
      const sq = squish.current;
      const rx = BALL_R * (2 - sq);
      const ry = BALL_R * sq;

      // Shadow
      ctx.fillStyle = alpha(theme.palette.text.primary, 0.05);
      ctx.beginPath();
      ctx.ellipse(bx, gnd + 1, rx * 0.6, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      const gr = ctx.createRadialGradient(bx - rx * 0.2, drawY - ry * 0.3, 0, bx, drawY, Math.max(rx, ry));
      gr.addColorStop(0, theme.palette.secondary.main);
      gr.addColorStop(1, theme.palette.secondary.dark ?? theme.palette.secondary.main);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(bx, drawY - ry, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(bx - rx * 0.2, drawY - ry * 1.2, rx * 0.2, ry * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      if (gs.current !== 'dead') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(bx + rx * 0.3, drawY - ry, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = theme.palette.text.primary;
        ctx.beginPath(); ctx.arc(bx + rx * 0.4, drawY - ry, 1, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = theme.palette.text.primary;
        ctx.lineWidth = 1;
        const ex = bx + rx * 0.3, ey = drawY - ry;
        ctx.beginPath();
        ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2);
        ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2);
        ctx.stroke();
      }

      // Score on canvas (always visible during play)
      if (gs.current === 'play') {
        ctx.font = '700 11px monospace';
        ctx.fillStyle = theme.palette.text.secondary;
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(String(sc.current).padStart(5, '0'), w - 10, 6);
        if (hi.current > 0) {
          ctx.fillStyle = alpha(theme.palette.text.secondary, 0.4);
          ctx.font = '500 9px monospace';
          ctx.fillText('HI ' + String(hi.current).padStart(5, '0'), w - 10, 20);
        }
      }

      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); };
  }, [theme, die]);

  return (
    <Box
      sx={{
        position: uiState === 'play' ? 'fixed' : 'relative',
        bottom: uiState === 'play' ? 0 : 'auto',
        left: 0, right: 0,
        height: { xs: 80, md: 90 },
        zIndex: uiState === 'play' ? 50 : 1,
        borderTop: '1px solid', borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.default, uiState === 'play' ? 0.95 : 0.7),
        backdropFilter: uiState === 'play' ? 'blur(12px)' : 'none',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={() => { if (gs.current === 'play') jump(); }}
        onMouseUp={releaseJump}
        onTouchStart={() => { if (gs.current === 'play') jump(); }}
        onTouchEnd={releaseJump}
        style={{ width: '100%', height: '100%', display: 'block', cursor: uiState === 'play' ? 'pointer' : 'default' }}
      />

      {/* START / GAME OVER overlay — rendered as HTML on top of canvas */}
      {uiState !== 'play' && (
        <Box
          sx={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: alpha(theme.palette.background.default, 0.5),
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            {uiState === 'dead' && (
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                Score: {uiScore}
              </Typography>
            )}

            <Button
              variant="contained"
              size="small"
              onClick={startGame}
              sx={{ borderRadius: 2, px: 3, py: 0.8, fontWeight: 700, fontSize: '0.85rem' }}
            >
              {uiState === 'dead' ? 'Play Again' : 'Start Game'}
            </Button>

            {uiHi > 0 && (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                Best: {uiHi}
              </Typography>
            )}

            {uiState === 'idle' && (
              <Typography variant="caption" sx={{ color: 'text.disabled', display: { xs: 'none', md: 'block' } }}>
                SPACE to jump · DOWN to duck
              </Typography>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
