'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';

/**
 * Ball Runner — subtle Chrome Dino-style easter egg on the landing page.
 *
 * Design principles:
 * - Tiny and subtle when idle (just a thin strip with faint "Press SPACE" text)
 * - Expands slightly when playing
 * - Fades out when user scrolls past the hero section
 * - Ball is a proper circle, larger, with satisfying squish
 * - HOLD jump = dramatically longer airtime (variable gravity)
 * - Game area is narrower (centered, not full width)
 */

const LS_KEY = 'rag_runner_hi';

// Physics — tuned for ~60px play area
const JUMP_VEL = -4;
const GRAV_HOLD = 0.04;   // while holding jump key AND rising
const GRAV_NORMAL = 0.15;  // rising, key released
const GRAV_FALL = 0.25;    // falling
const BALL_R = 9;
const GROUND_PAD = 10;
const SPEED_INIT = 1.2;
const SPEED_MAX = 3.5;
const SPEED_INC = 0.0003;
const GAME_WIDTH = 500; // px, centered

interface Spike { x: number; ground: boolean; w: number; h: number; }

export default function MeepleRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  const gs = useRef<'idle' | 'play' | 'dead'>('idle');
  const sc = useRef(0);
  const hi = useRef(0);
  const spd = useRef(SPEED_INIT);
  const ballY = useRef(0);
  const velY = useRef(0);
  const duckRef = useRef(false);
  // THIS IS THE KEY: a simple boolean flag, set on keydown, cleared on keyup
  const holdingJump = useRef(false);
  const squishFrames = useRef(0);
  const spikes = useRef<Spike[]>([]);
  const fr = useRef(0);
  const nextGap = useRef(60); // first spike comes quickly
  const [uiState, setUiState] = useState<'idle' | 'play' | 'dead'>('idle');
  const [uiScore, setUiScore] = useState(0);
  const [uiHi, setUiHi] = useState(0);
  const [visible, setVisible] = useState(true);

  // Load hi score
  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem(LS_KEY) ?? '0', 10);
      if (v > 0) { hi.current = v; setUiHi(v); }
    } catch {}
  }, []);

  // Scroll visibility — fade out after hero
  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY < window.innerHeight * 1.2);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const start = useCallback(() => {
    gs.current = 'play'; setUiState('play');
    sc.current = 0; spd.current = SPEED_INIT;
    ballY.current = 0; velY.current = 0;
    duckRef.current = false; holdingJump.current = false;
    squishFrames.current = 0; spikes.current = [];
    fr.current = 0; nextGap.current = 60; setUiScore(0);
  }, []);

  const die = useCallback(() => {
    gs.current = 'dead'; setUiState('dead'); setUiScore(sc.current);
    if (sc.current > hi.current) {
      hi.current = sc.current; setUiHi(sc.current);
      try { localStorage.setItem(LS_KEY, String(sc.current)); } catch {}
    }
  }, []);

  // Keyboard — the ONLY place holdingJump is set/cleared
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const k = e.key;

      // Start game on any valid key when not playing
      if (gs.current !== 'play') {
        if (k === ' ' || k === 'ArrowUp') { e.preventDefault(); start(); }
        return;
      }

      if (k === ' ' || k === 'ArrowUp') {
        e.preventDefault();
        holdingJump.current = true;
        // Only initiate jump on first press (not repeat)
        if (!e.repeat && ballY.current < 0.5) {
          velY.current = JUMP_VEL;
        }
      }
      if (k === 'ArrowDown') { e.preventDefault(); duckRef.current = true; }
    };

    const ku = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        holdingJump.current = false;
      }
      if (e.key === 'ArrowDown') duckRef.current = false;
    };

    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [start]);

  // Touch/click handlers
  const onPointerDown = useCallback(() => {
    if (gs.current !== 'play') { start(); return; }
    holdingJump.current = true;
    if (ballY.current < 0.5) velY.current = JUMP_VEL;
  }, [start]);

  const onPointerUp = useCallback(() => {
    holdingJump.current = false;
  }, []);

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

      // Game area is centered, max GAME_WIDTH
      const gameW = Math.min(w, GAME_WIDTH);
      const offsetX = (w - gameW) / 2;

      const gnd = h - GROUND_PAD;
      const bx = offsetX + 40;
      const playTop = 2;

      // Ground line (only in game area)
      ctx.strokeStyle = alpha(theme.palette.divider, 0.15);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(offsetX, gnd);
      ctx.lineTo(offsetX + gameW, gnd);
      ctx.stroke();
      ctx.setLineDash([]);

      if (gs.current === 'play') {
        fr.current++;
        spd.current = Math.min(SPEED_MAX, spd.current + SPEED_INC);
        sc.current = Math.floor(fr.current / 10);
        if (fr.current % 10 === 0) setUiScore(sc.current);

        // ── PHYSICS ──
        // The ENTIRE point: gravity depends on whether jump is HELD
        const rising = velY.current < 0;
        const grav = rising
          ? (holdingJump.current ? GRAV_HOLD : GRAV_NORMAL)
          : GRAV_FALL;

        velY.current += grav;
        ballY.current -= velY.current;

        // Landing
        if (ballY.current <= 0) {
          if (velY.current > 0.5) squishFrames.current = 6;
          ballY.current = 0; velY.current = 0;
        }

        // Ceiling cap
        const maxH = gnd - playTop - BALL_R * 2;
        if (ballY.current > maxH) { ballY.current = maxH; if (velY.current < 0) velY.current = 0; }

        if (squishFrames.current > 0) squishFrames.current--;

        // Spawn spikes (relative to game area, not full canvas)
        nextGap.current -= spd.current;
        if (nextGap.current <= 0) {
          const playArea = gnd - playTop;
          const ceil = Math.random() < 0.2 && sc.current > 25;
          spikes.current.push({
            x: gameW + 10, // start at right edge of game area
            ground: !ceil,
            w: 6 + Math.random() * 5,
            h: ceil
              ? playArea * (0.55 + Math.random() * 0.15)
              : 7 + Math.random() * (BALL_R * 2),
          });
          nextGap.current = 50 + Math.random() * 120;
        }

        for (const s of spikes.current) s.x -= spd.current;
        spikes.current = spikes.current.filter(s => s.x > -20);

        // Collision
        const isDuck = duckRef.current && ballY.current < 1;
        const effH = isDuck ? BALL_R * 0.8 : BALL_R * 2;
        const localBx = 40; // ball X in game-area coords

        for (const s of spikes.current) {
          if (localBx + BALL_R < s.x || localBx - BALL_R > s.x + s.w) continue;
          if (s.ground) {
            if (ballY.current < s.h) { die(); break; }
          } else {
            const tipBallY = gnd - playTop - s.h;
            if (ballY.current + effH > tipBallY) { die(); break; }
          }
        }
      }

      // ── DRAW ──

      // Spikes (offset by game area)
      ctx.fillStyle = alpha(theme.palette.text.primary, 0.4);
      for (const s of spikes.current) {
        const sx = offsetX + s.x;
        ctx.beginPath();
        if (s.ground) {
          ctx.moveTo(sx, gnd); ctx.lineTo(sx + s.w / 2, gnd - s.h); ctx.lineTo(sx + s.w, gnd);
        } else {
          ctx.moveTo(sx, playTop); ctx.lineTo(sx + s.w / 2, playTop + s.h); ctx.lineTo(sx + s.w, playTop);
        }
        ctx.closePath(); ctx.fill();
      }

      // Ball
      const drawY = gnd - ballY.current;
      const isDuck = duckRef.current && ballY.current < 1 && gs.current === 'play';
      const isSquish = squishFrames.current > 0;

      let rx = BALL_R, ry = BALL_R;
      if (isDuck) { rx = BALL_R * 1.3; ry = BALL_R * 0.5; }
      else if (isSquish) {
        const t = squishFrames.current / 6;
        rx = BALL_R * (1 + t * 0.35);
        ry = BALL_R * (1 - t * 0.3);
      }

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
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.ellipse(bx - rx * 0.15, drawY - ry * 1.2, rx * 0.2, ry * 0.15, 0, 0, Math.PI * 2); ctx.fill();

      // Eye
      if (gs.current !== 'dead') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(bx + rx * 0.25, drawY - ry * 1.05, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = theme.palette.text.primary;
        ctx.beginPath(); ctx.arc(bx + rx * 0.35, drawY - ry * 1.05, 1, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = theme.palette.text.primary; ctx.lineWidth = 1.2;
        const ex = bx + rx * 0.25, ey = drawY - ry * 1.05;
        ctx.beginPath();
        ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2);
        ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2);
        ctx.stroke();
      }

      // Score
      if (gs.current === 'play') {
        ctx.font = '700 9px monospace';
        ctx.fillStyle = alpha(theme.palette.text.secondary, 0.6);
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(String(sc.current).padStart(5, '0'), offsetX + gameW - 4, 2);
        if (hi.current > 0) {
          ctx.fillStyle = alpha(theme.palette.text.secondary, 0.3);
          ctx.font = '500 7px monospace';
          ctx.fillText('HI ' + String(hi.current).padStart(5, '0'), offsetX + gameW - 4, 13);
        }
      }

      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); };
  }, [theme, die]);

  if (!visible) return null;

  return (
    <Box
      sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: uiState === 'play' ? { xs: 60, md: 70 } : { xs: 28, md: 32 },
        zIndex: 30,
        borderTop: uiState === 'play' ? '1px solid' : 'none',
        borderColor: 'divider',
        bgcolor: uiState === 'play'
          ? alpha(theme.palette.background.default, 0.94)
          : 'transparent',
        backdropFilter: uiState === 'play' ? 'blur(10px)' : 'none',
        overflow: 'hidden',
        transition: 'height 300ms ease, background-color 300ms ease',
        cursor: 'pointer',
      }}
      onMouseDown={onPointerDown}
      onMouseUp={onPointerUp}
      onTouchStart={onPointerDown}
      onTouchEnd={onPointerUp}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {/* Idle: subtle hint. Dead: score + retry */}
      {uiState !== 'play' && (
        <Box
          sx={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {uiState === 'idle' ? (
            <Typography
              variant="caption"
              sx={{
                color: alpha(theme.palette.text.secondary, 0.3),
                fontSize: '0.65rem',
                letterSpacing: '0.1em',
                userSelect: 'none',
              }}
            >
              press SPACE to play
            </Typography>
          ) : (
            <Typography
              variant="caption"
              sx={{
                color: alpha(theme.palette.text.secondary, 0.5),
                fontSize: '0.7rem',
                userSelect: 'none',
              }}
            >
              Score: {uiScore}{uiHi > uiScore ? ` · Best: ${uiHi}` : ' · New best!'} — SPACE to retry
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
