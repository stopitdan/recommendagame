'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';

/**
 * Ball Runner — Chrome Dino clone.
 *
 * Uses module-level globals for input state to avoid any React
 * closure/ref issues with the animation loop.
 */

const LS_KEY = 'rag_runner_hi';

// Module-level input state — guaranteed no closure issues
let JUMP_PRESSED = false;
let DUCK_PRESSED = false;

// Physics
const BALL_R = 10;
const GROUND_PAD = 12;
const GAME_W = 480;
const SPEED_INIT = 1.3;
const SPEED_MAX = 3.8;
const SPEED_INC = 0.0003;

export default function MeepleRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  const gs = useRef<'idle' | 'play' | 'dead'>('idle');
  const sc = useRef(0);
  const hi = useRef(0);
  const spd = useRef(SPEED_INIT);
  const posY = useRef(0);    // ball position above ground
  const velY = useRef(0);    // velocity (negative = up)
  const squishT = useRef(0); // squish countdown
  const spikes = useRef<{ x: number; ground: boolean; w: number; h: number }[]>([]);
  const fr = useRef(0);
  const nextGap = useRef(50);

  const [uiState, setUiState] = useState<'idle' | 'play' | 'dead'>('idle');
  const [uiScore, setUiScore] = useState(0);
  const [uiHi, setUiHi] = useState(0);
  const [vis, setVis] = useState(true);

  useEffect(() => {
    try {
      const v = parseInt(localStorage.getItem(LS_KEY) ?? '0', 10);
      if (v > 0) { hi.current = v; setUiHi(v); }
    } catch {}
  }, []);

  // Fade on scroll
  useEffect(() => {
    const fn = () => setVis(window.scrollY < window.innerHeight * 1.5);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const start = useCallback(() => {
    gs.current = 'play'; setUiState('play');
    sc.current = 0; spd.current = SPEED_INIT;
    posY.current = 0; velY.current = 0;
    JUMP_PRESSED = false; DUCK_PRESSED = false;
    squishT.current = 0; spikes.current = [];
    fr.current = 0; nextGap.current = 50; setUiScore(0);
  }, []);

  const die = useCallback(() => {
    gs.current = 'dead'; setUiState('dead'); setUiScore(sc.current);
    if (sc.current > hi.current) {
      hi.current = sc.current; setUiHi(sc.current);
      try { localStorage.setItem(LS_KEY, String(sc.current)); } catch {}
    }
  }, []);

  // Global keyboard listeners — set module-level vars directly
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        JUMP_PRESSED = true;
        if (gs.current !== 'play') start();
        else if (!e.repeat && posY.current < 0.5) velY.current = -4.2;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); DUCK_PRESSED = true; }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') JUMP_PRESSED = false;
      if (e.key === 'ArrowDown') DUCK_PRESSED = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [start]);

  // Pointer handlers
  const pd = useCallback(() => {
    JUMP_PRESSED = true;
    if (gs.current !== 'play') start();
    else if (posY.current < 0.5) velY.current = -4.2;
  }, [start]);
  const pu = useCallback(() => { JUMP_PRESSED = false; }, []);

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

      const gw = Math.min(w, GAME_W);
      const ox = (w - gw) / 2;
      const gnd = h - GROUND_PAD;
      const bx = ox + 36;

      // Ground
      ctx.strokeStyle = alpha(theme.palette.divider, 0.15);
      ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(ox, gnd); ctx.lineTo(ox + gw, gnd); ctx.stroke();
      ctx.setLineDash([]);

      if (gs.current === 'play') {
        fr.current++;
        spd.current = Math.min(SPEED_MAX, spd.current + SPEED_INC);
        sc.current = Math.floor(fr.current / 10);
        if (fr.current % 10 === 0) setUiScore(sc.current);

        // ═══════ THE PHYSICS ═══════
        // This is dead simple:
        //   rising + holding jump → tiny gravity (ball floats up slowly)
        //   rising + NOT holding  → normal gravity (ball decelerates quickly)
        //   falling               → fast gravity (snappy landing)
        const rising = velY.current < 0;
        const gravity = rising
          ? (JUMP_PRESSED ? 0.04 : 0.16)
          : 0.22;

        velY.current += gravity;
        posY.current -= velY.current;

        if (posY.current <= 0) {
          if (velY.current > 0.3) squishT.current = 8;
          posY.current = 0; velY.current = 0;
        }
        const maxH = gnd - 4 - BALL_R * 2;
        if (posY.current > maxH) { posY.current = maxH; if (velY.current < 0) velY.current = 0; }

        if (squishT.current > 0) squishT.current--;

        // Spikes
        nextGap.current -= spd.current;
        if (nextGap.current <= 0) {
          const ceil = Math.random() < 0.18 && sc.current > 25;
          const pa = gnd - 4;
          spikes.current.push({
            x: gw + 8,
            ground: !ceil,
            w: 6 + Math.random() * 5,
            h: ceil ? pa * (0.55 + Math.random() * 0.12) : 8 + Math.random() * BALL_R * 2,
          });
          nextGap.current = 55 + Math.random() * 140;
        }
        for (const s of spikes.current) s.x -= spd.current;
        spikes.current = spikes.current.filter(s => s.x > -15);

        // Collision
        const duck = DUCK_PRESSED && posY.current < 1;
        const effH = duck ? BALL_R * 0.7 : BALL_R * 2;
        const lbx = 36;
        for (const s of spikes.current) {
          if (lbx + BALL_R < s.x || lbx - BALL_R > s.x + s.w) continue;
          if (s.ground) {
            if (posY.current < s.h) { die(); break; }
          } else {
            if (posY.current + effH > gnd - 4 - s.h) { die(); break; }
          }
        }
      }

      // ═══════ DRAW ═══════
      ctx.fillStyle = alpha(theme.palette.text.primary, 0.35);
      for (const s of spikes.current) {
        const sx = ox + s.x;
        ctx.beginPath();
        if (s.ground) {
          ctx.moveTo(sx, gnd); ctx.lineTo(sx + s.w / 2, gnd - s.h); ctx.lineTo(sx + s.w, gnd);
        } else {
          ctx.moveTo(sx, 2); ctx.lineTo(sx + s.w / 2, 2 + s.h); ctx.lineTo(sx + s.w, 2);
        }
        ctx.closePath(); ctx.fill();
      }

      // Ball
      const dy = gnd - posY.current;
      const duck = DUCK_PRESSED && posY.current < 1 && gs.current === 'play';
      const sq = squishT.current > 0;
      let rx = BALL_R, ry = BALL_R;
      if (duck) { rx = BALL_R * 1.35; ry = BALL_R * 0.45; }
      else if (sq) { const t = squishT.current / 8; rx = BALL_R * (1 + t * 0.3); ry = BALL_R * (1 - t * 0.25); }

      // Shadow
      ctx.fillStyle = alpha(theme.palette.text.primary, 0.04);
      ctx.beginPath(); ctx.ellipse(bx, gnd + 1, rx * 0.5, 1, 0, 0, Math.PI * 2); ctx.fill();

      // Body
      const gr = ctx.createRadialGradient(bx - rx * 0.2, dy - ry * 0.3, 0, bx, dy, Math.max(rx, ry));
      gr.addColorStop(0, theme.palette.secondary.main);
      gr.addColorStop(1, theme.palette.secondary.dark ?? theme.palette.secondary.main);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(bx, dy - ry, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.ellipse(bx - rx * 0.15, dy - ry * 1.2, rx * 0.2, ry * 0.13, 0, 0, Math.PI * 2); ctx.fill();

      // Eye
      if (gs.current !== 'dead') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(bx + rx * 0.25, dy - ry, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = theme.palette.text.primary;
        ctx.beginPath(); ctx.arc(bx + rx * 0.35, dy - ry, 1.1, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = theme.palette.text.primary; ctx.lineWidth = 1.2;
        const ex = bx + rx * 0.25, ey = dy - ry;
        ctx.beginPath();
        ctx.moveTo(ex - 2.5, ey - 2.5); ctx.lineTo(ex + 2.5, ey + 2.5);
        ctx.moveTo(ex + 2.5, ey - 2.5); ctx.lineTo(ex - 2.5, ey + 2.5);
        ctx.stroke();
      }

      // Score
      if (gs.current === 'play') {
        ctx.font = '700 9px monospace';
        ctx.fillStyle = alpha(theme.palette.text.secondary, 0.5);
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(String(sc.current).padStart(5, '0'), ox + gw - 4, 2);
        if (hi.current > 0) {
          ctx.fillStyle = alpha(theme.palette.text.secondary, 0.25);
          ctx.font = '500 7px monospace';
          ctx.fillText('HI ' + String(hi.current).padStart(5, '0'), ox + gw - 4, 12);
        }
      }

      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); };
  }, [theme, die]);

  if (!vis) return null;

  return (
    <Box
      sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: uiState === 'play' ? { xs: 60, md: 70 } : { xs: 24, md: 28 },
        zIndex: 30,
        borderTop: uiState === 'play' ? '1px solid' : 'none',
        borderColor: 'divider',
        bgcolor: uiState === 'play' ? alpha(theme.palette.background.default, 0.94) : 'transparent',
        backdropFilter: uiState === 'play' ? 'blur(10px)' : 'none',
        overflow: 'hidden',
        transition: 'height 250ms ease, background-color 250ms ease',
        cursor: 'pointer',
      }}
      onMouseDown={pd}
      onMouseUp={pu}
      onTouchStart={pd}
      onTouchEnd={pu}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {uiState !== 'play' && (
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {uiState === 'idle' ? (
            <Typography variant="caption" sx={{ color: alpha(theme.palette.text.secondary, 0.25), fontSize: '0.6rem', letterSpacing: '0.1em', userSelect: 'none' }}>
              press SPACE to play
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ color: alpha(theme.palette.text.secondary, 0.4), fontSize: '0.65rem', userSelect: 'none' }}>
              Score: {uiScore}{uiHi > uiScore ? ` · Best: ${uiHi}` : ' · New best!'} — SPACE to retry
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
