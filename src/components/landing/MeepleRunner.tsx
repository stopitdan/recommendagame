'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { useTheme, alpha } from '@mui/material/styles';

/**
 * Ball Runner — Chrome Dino clone, fixed to bottom of viewport.
 *
 * ALWAYS visible at the bottom of the screen with a "Start Game" button.
 * Hold SPACE/UP for longer jumps (reduced gravity while key held + rising).
 * DOWN to duck. Speed increases gradually. Score + high score tracked.
 */

const LS_KEY = 'rag_runner_hi';

// Physics tuned for ~80px tall canvas
const JUMP_VEL = -5.5;
const GRAVITY = 0.22;
const GRAVITY_HOLD = 0.08; // 1/3 normal gravity while holding jump + rising
const SPEED_INIT = 1.5;
const SPEED_MAX = 4.5;
const SPEED_INC = 0.0004;
const GROUND_PAD = 14;
const BALL_R = 7;

interface Spike { x: number; ground: boolean; w: number; h: number; }

export default function MeepleRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  const gs = useRef<'idle' | 'play' | 'dead'>('idle');
  const sc = useRef(0);
  const hi = useRef(0);
  const spd = useRef(SPEED_INIT);
  const by = useRef(0);
  const bvy = useRef(0);
  const duckRef = useRef(false);
  const jumpHeld = useRef(false); // TRUE while jump key/button is physically held down
  const squish = useRef(1);
  const spikes = useRef<Spike[]>([]);
  const fr = useRef(0);
  const nextGap = useRef(120);

  const [uiState, setUiState] = useState<'idle' | 'play' | 'dead'>('idle');
  const [uiScore, setUiScore] = useState(0);
  const [uiHi, setUiHi] = useState(0);

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
    duckRef.current = false; jumpHeld.current = false;
    squish.current = 1; spikes.current = [];
    fr.current = 0; nextGap.current = 120;
    setUiScore(0);
  }, []);

  const die = useCallback(() => {
    gs.current = 'dead'; setUiState('dead');
    setUiScore(sc.current);
    if (sc.current > hi.current) {
      hi.current = sc.current; setUiHi(sc.current);
      try { localStorage.setItem(LS_KEY, String(sc.current)); } catch {}
    }
  }, []);

  const tryJump = useCallback(() => {
    if (by.current < 0.5) {
      bvy.current = JUMP_VEL;
      squish.current = 1.25;
    }
  }, []);

  // Keyboard — track held state explicitly
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const k = e.key;
      if (gs.current !== 'play') {
        if (k === ' ' || k === 'ArrowUp') { e.preventDefault(); startGame(); }
        return;
      }
      if (k === ' ' || k === 'ArrowUp') {
        e.preventDefault();
        if (!e.repeat) tryJump(); // only first press triggers jump
        jumpHeld.current = true;  // stays true while held (even on repeat)
      }
      if (k === 'ArrowDown') { e.preventDefault(); duckRef.current = true; }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') duckRef.current = false;
      if (e.key === ' ' || e.key === 'ArrowUp') jumpHeld.current = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [startGame, tryJump]);

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
      const bx = 45;
      const playTop = 4;

      // Ground
      ctx.strokeStyle = alpha(theme.palette.divider, 0.2);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, gnd); ctx.lineTo(w, gnd); ctx.stroke();
      ctx.setLineDash([]);

      if (gs.current === 'play') {
        fr.current++;
        spd.current = Math.min(SPEED_MAX, spd.current + SPEED_INC);
        sc.current = Math.floor(fr.current / 10);
        if (fr.current % 10 === 0) setUiScore(sc.current);

        // PHYSICS — the key Chrome Dino mechanic:
        // While jumpHeld is true AND ball is still rising (bvy < 0),
        // use much lower gravity so the ball floats longer at the peak.
        const rising = bvy.current < 0;
        const grav = (jumpHeld.current && rising) ? GRAVITY_HOLD : GRAVITY;
        bvy.current += grav;
        by.current -= bvy.current;

        // Ground clamp
        const wasAir = by.current > 0.5 || bvy.current !== 0;
        if (by.current < 0) {
          const landing = wasAir && bvy.current > 0;
          by.current = 0; bvy.current = 0;
          if (landing) squish.current = 0.5;
        }

        // Ceiling clamp
        const maxH = gnd - playTop - BALL_R * 2;
        if (by.current > maxH) { by.current = maxH; if (bvy.current < 0) bvy.current = 0; }

        // Squish spring recovery
        squish.current += (1 - squish.current) * 0.1;
        if (duckRef.current && by.current < 1) squish.current = 0.35;

        // Spawn spikes
        nextGap.current -= spd.current;
        if (nextGap.current <= 0) {
          const playArea = gnd - playTop;
          const ceil = Math.random() < 0.2 && sc.current > 30;
          spikes.current.push({
            x: w + 10,
            ground: !ceil,
            w: 7 + Math.random() * 5,
            h: ceil
              ? playArea * (0.55 + Math.random() * 0.15) // must duck
              : 8 + Math.random() * (BALL_R * 2.5),
          });
          nextGap.current = 70 + Math.random() * 180;
        }

        for (const s of spikes.current) s.x -= spd.current;
        spikes.current = spikes.current.filter(s => s.x > -20);

        // Collision
        const effH = BALL_R * 2 * Math.min(squish.current, 1);
        for (const s of spikes.current) {
          if (bx + BALL_R < s.x || bx - BALL_R > s.x + s.w) continue;
          if (s.ground) {
            if (by.current < s.h) { die(); break; }
          } else {
            const tipBallY = gnd - playTop - s.h;
            if (by.current + effH > tipBallY) { die(); break; }
          }
        }
      }

      // ── DRAW ──

      // Spikes
      ctx.fillStyle = alpha(theme.palette.text.primary, 0.45);
      for (const s of spikes.current) {
        ctx.beginPath();
        if (s.ground) {
          ctx.moveTo(s.x, gnd); ctx.lineTo(s.x + s.w / 2, gnd - s.h); ctx.lineTo(s.x + s.w, gnd);
        } else {
          ctx.moveTo(s.x, playTop); ctx.lineTo(s.x + s.w / 2, playTop + s.h); ctx.lineTo(s.x + s.w, playTop);
        }
        ctx.closePath(); ctx.fill();
      }

      // Ball
      const drawY = gnd - by.current;
      const sq = squish.current;
      const rx = BALL_R * (2 - sq);
      const ry = BALL_R * sq;

      // Shadow
      ctx.fillStyle = alpha(theme.palette.text.primary, 0.04);
      ctx.beginPath(); ctx.ellipse(bx, gnd + 1, rx * 0.5, 1, 0, 0, Math.PI * 2); ctx.fill();

      // Body
      const gr = ctx.createRadialGradient(bx - rx * 0.2, drawY - ry * 0.3, 0, bx, drawY, Math.max(rx, ry));
      gr.addColorStop(0, theme.palette.secondary.main);
      gr.addColorStop(1, theme.palette.secondary.dark ?? theme.palette.secondary.main);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(bx, drawY - ry, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.ellipse(bx - rx * 0.2, drawY - ry * 1.15, rx * 0.2, ry * 0.12, 0, 0, Math.PI * 2); ctx.fill();

      // Eye
      if (gs.current !== 'dead') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(bx + rx * 0.3, drawY - ry, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = theme.palette.text.primary;
        ctx.beginPath(); ctx.arc(bx + rx * 0.38, drawY - ry, 0.8, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = theme.palette.text.primary; ctx.lineWidth = 1;
        const ex = bx + rx * 0.3, ey = drawY - ry;
        ctx.beginPath();
        ctx.moveTo(ex - 1.5, ey - 1.5); ctx.lineTo(ex + 1.5, ey + 1.5);
        ctx.moveTo(ex + 1.5, ey - 1.5); ctx.lineTo(ex - 1.5, ey + 1.5);
        ctx.stroke();
      }

      // Score (canvas-drawn during play)
      if (gs.current === 'play') {
        ctx.font = '700 10px monospace';
        ctx.fillStyle = theme.palette.text.secondary;
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(String(sc.current).padStart(5, '0'), w - 8, 4);
        if (hi.current > 0) {
          ctx.fillStyle = alpha(theme.palette.text.secondary, 0.35);
          ctx.font = '500 8px monospace';
          ctx.fillText('HI ' + String(hi.current).padStart(5, '0'), w - 8, 16);
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
        // ALWAYS fixed at bottom — visible on every scroll position
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: { xs: 70, md: 80 },
        zIndex: 40,
        borderTop: '1px solid', borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.default, 0.92),
        backdropFilter: 'blur(10px)',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={() => { if (gs.current === 'play') { tryJump(); jumpHeld.current = true; } }}
        onMouseUp={() => { jumpHeld.current = false; }}
        onTouchStart={() => { if (gs.current === 'play') { tryJump(); jumpHeld.current = true; } }}
        onTouchEnd={() => { jumpHeld.current = false; }}
        style={{ width: '100%', height: '100%', display: 'block', cursor: uiState === 'play' ? 'pointer' : 'default' }}
      />

      {/* START / GAME OVER — always-visible HTML overlay */}
      {uiState !== 'play' && (
        <Box
          sx={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: alpha(theme.palette.background.default, 0.6),
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            {uiState === 'dead' && (
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'secondary.main', fontSize: '0.8rem' }}>
                Score: {uiScore}
              </Typography>
            )}
            <Button
              variant="contained"
              size="small"
              onClick={startGame}
              sx={{ borderRadius: 2, px: 2.5, py: 0.6, fontWeight: 700, fontSize: '0.8rem' }}
            >
              {uiState === 'dead' ? 'Play Again' : 'Start Game'}
            </Button>
            {uiHi > 0 && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                Best: {uiHi}
              </Typography>
            )}
            {uiState === 'idle' && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem', display: { xs: 'none', sm: 'block' } }}>
                SPACE jump · DOWN duck
              </Typography>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
