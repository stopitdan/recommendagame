'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';

const LS_KEY = 'rag_runner_hi';

// Physics for ~80px play area
const BALL_R = 8;
const JUMP_V = -3.5;     // initial upward velocity
const GRAVITY = 0.15;     // normal gravity (always applied when key NOT held)
const FALL_GRAVITY = 0.3; // faster fall after releasing
const SPEED0 = 1.2;
const SPEED_MAX = 3.5;
const SPEED_INC = 0.00025;
const GAME_W = 460;
const GND_PAD = 12;

interface Spike { x: number; gnd: boolean; w: number; h: number }

export default function MeepleRunner() {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  // All game state
  const gs = useRef<'idle' | 'play' | 'dead'>('idle');
  const sc = useRef(0); const hi = useRef(0);
  const spd = useRef(SPEED0);
  const py = useRef(0); const vy = useRef(0);
  const sqT = useRef(0);
  const spikes = useRef<Spike[]>([]);
  const fr = useRef(0); const nxt = useRef(40);

  // Input: track via DOM attribute on canvas (avoids ALL React closure issues)
  // The canvas element itself is the source of truth for input state
  const isJumpHeld = () => canvasRef.current?.dataset.jump === '1';
  const isDuckHeld = () => canvasRef.current?.dataset.duck === '1';
  const setJump = (v: boolean) => { if (canvasRef.current) canvasRef.current.dataset.jump = v ? '1' : '0'; };
  const setDuck = (v: boolean) => { if (canvasRef.current) canvasRef.current.dataset.duck = v ? '1' : '0'; };

  const [ui, setUi] = useState<'idle' | 'play' | 'dead'>('idle');
  const [uiSc, setUiSc] = useState(0);
  const [uiHi, setUiHi] = useState(0);
  const [vis, setVis] = useState(true);

  useEffect(() => {
    try { const v = parseInt(localStorage.getItem(LS_KEY) ?? '0'); if (v > 0) { hi.current = v; setUiHi(v); } } catch {}
  }, []);

  useEffect(() => {
    const fn = () => setVis(window.scrollY < window.innerHeight * 1.3);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // ResizeObserver for canvas sizing
  useEffect(() => {
    const box = boxRef.current; const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const obs = new ResizeObserver(() => {
      const r = box.getBoundingClientRect();
      const d = devicePixelRatio || 1;
      canvas.width = Math.round(r.width * d);
      canvas.height = Math.round(r.height * d);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
    });
    obs.observe(box);
    return () => obs.disconnect();
  }, []);

  const start = useCallback(() => {
    gs.current = 'play'; setUi('play');
    sc.current = 0; spd.current = SPEED0;
    py.current = 0; vy.current = JUMP_V; // start with a jump!
    setDuck(false);
    sqT.current = 0; spikes.current = [];
    fr.current = 0; nxt.current = 40; setUiSc(0);
  }, []);

  const die = useCallback(() => {
    gs.current = 'dead'; setUi('dead'); setUiSc(sc.current);
    if (sc.current > hi.current) {
      hi.current = sc.current; setUiHi(sc.current);
      try { localStorage.setItem(LS_KEY, String(sc.current)); } catch {}
    }
  }, []);

  // Keyboard
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        setJump(true);
        if (gs.current !== 'play') { start(); return; }
        if (!e.repeat && py.current < 0.5) vy.current = JUMP_V;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); setDuck(true); }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') setJump(false);
      if (e.key === 'ArrowDown') setDuck(false);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [start]);

  const pDown = useCallback(() => {
    setJump(true);
    if (gs.current !== 'play') { start(); return; }
    if (py.current < 0.5) vy.current = JUMP_V;
  }, [start]);
  const pUp = useCallback(() => setJump(false), []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let anim: number;

    const loop = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { anim = requestAnimationFrame(loop); return; }
      const dpr = devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      if (h < 10) { anim = requestAnimationFrame(loop); return; }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const gw = Math.min(w - 20, GAME_W);
      const ox = (w - gw) / 2;
      const gnd = h - GND_PAD;
      const playH = gnd - 4;
      const bx = ox + 35;

      // Ground
      ctx.strokeStyle = alpha(theme.palette.divider, 0.15);
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(ox, gnd); ctx.lineTo(ox + gw, gnd); ctx.stroke();

      // Read input from DOM data attributes (immune to closures)
      const jumpHeld = canvas.dataset.jump === '1';
      const duckHeld = canvas.dataset.duck === '1';

      if (gs.current === 'play') {
        fr.current++;
        spd.current = Math.min(SPEED_MAX, spd.current + SPEED_INC);
        sc.current = Math.floor(fr.current / 10);
        if (fr.current % 10 === 0) setUiSc(sc.current);

        // ═══ PHYSICS — the simplest possible implementation ═══
        //
        // While HOLDING jump and ball is RISING:
        //   → NO gravity applied. Ball coasts upward at current velocity.
        //   → Velocity slowly decays toward 0 (slight drag).
        //
        // When jump RELEASED or ball starts FALLING:
        //   → Full gravity pulls it down fast.
        //
        // This means:
        //   TAP: ball rises briefly, key released, gravity kicks in immediately
        //   HOLD: ball rises for as long as you hold, floating at the top

        const rising = vy.current < 0;

        if (rising && jumpHeld) {
          // HOLDING + RISING: almost no gravity, just slight deceleration
          vy.current *= 0.97; // gentle drag, ball slowly decelerates
        } else if (rising && !jumpHeld) {
          // RELEASED while rising: normal gravity, starts coming down
          vy.current += GRAVITY;
        } else {
          // FALLING: fast gravity for snappy landing
          vy.current += FALL_GRAVITY;
        }

        py.current -= vy.current;

        // Ground
        if (py.current < 0) {
          if (vy.current > 0.2) sqT.current = 6;
          py.current = 0; vy.current = 0;
        }
        // Ceiling
        const maxY = playH - BALL_R * 2;
        if (py.current > maxY) { py.current = maxY; if (vy.current < 0) vy.current = 0; }

        if (sqT.current > 0) sqT.current--;

        // Spikes
        nxt.current -= spd.current;
        if (nxt.current <= 0) {
          const ceil = Math.random() < 0.18 && sc.current > 25;
          spikes.current.push({
            x: gw + 5,
            gnd: !ceil,
            w: 8 + Math.random() * 6,
            h: ceil ? playH * (0.45 + Math.random() * 0.15) : 10 + Math.random() * 15,
          });
          nxt.current = 50 + Math.random() * 130;
        }
        for (const s of spikes.current) s.x -= spd.current;
        spikes.current = spikes.current.filter(s => s.x > -15);

        // Collision
        const duck = duckHeld && py.current < 0.5;
        const eH = duck ? BALL_R : BALL_R * 2;
        const lx = 35;
        for (const s of spikes.current) {
          if (lx + BALL_R < s.x || lx - BALL_R > s.x + s.w) continue;
          if (s.gnd) { if (py.current < s.h) { die(); break; } }
          else { if (py.current + eH > playH - s.h) { die(); break; } }
        }
      }

      // ═══ DRAW ═══
      ctx.fillStyle = alpha(theme.palette.text.primary, 0.3);
      for (const s of spikes.current) {
        const sx = ox + s.x;
        ctx.beginPath();
        if (s.gnd) { ctx.moveTo(sx, gnd); ctx.lineTo(sx + s.w / 2, gnd - s.h); ctx.lineTo(sx + s.w, gnd); }
        else { ctx.moveTo(sx, 4); ctx.lineTo(sx + s.w / 2, 4 + s.h); ctx.lineTo(sx + s.w, 4); }
        ctx.closePath(); ctx.fill();
      }

      // Ball
      const ballCenterY = gnd - py.current - BALL_R;
      const duck = duckHeld && py.current < 0.5 && gs.current === 'play';
      const sq = sqT.current > 0;
      let rx = BALL_R, ry = BALL_R;
      if (duck) { rx = BALL_R * 1.3; ry = BALL_R * 0.45; }
      else if (sq) { const t = sqT.current / 6; rx = BALL_R * (1 + t * 0.25); ry = BALL_R * (1 - t * 0.2); }

      ctx.fillStyle = alpha(theme.palette.text.primary, 0.04);
      ctx.beginPath(); ctx.ellipse(bx, gnd + 1, rx * 0.5, 1, 0, 0, Math.PI * 2); ctx.fill();

      const gr = ctx.createRadialGradient(bx - 2, ballCenterY - 2, 0, bx, ballCenterY, Math.max(rx, ry));
      gr.addColorStop(0, theme.palette.secondary.main);
      gr.addColorStop(1, theme.palette.secondary.dark ?? theme.palette.secondary.main);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(bx, ballCenterY, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.ellipse(bx - rx * 0.15, ballCenterY - ry * 0.4, rx * 0.2, ry * 0.15, 0, 0, Math.PI * 2); ctx.fill();

      if (gs.current !== 'dead') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(bx + rx * 0.25, ballCenterY - ry * 0.15, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = theme.palette.text.primary;
        ctx.beginPath(); ctx.arc(bx + rx * 0.35, ballCenterY - ry * 0.15, 0.8, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = theme.palette.text.primary; ctx.lineWidth = 1;
        const ex = bx + rx * 0.25, ey = ballCenterY - ry * 0.15;
        ctx.beginPath(); ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2); ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2); ctx.stroke();
      }

      // Score
      if (gs.current === 'play') {
        ctx.font = '600 10px monospace'; ctx.fillStyle = alpha(theme.palette.text.secondary, 0.45);
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(String(sc.current).padStart(5, '0'), ox + gw - 4, 4);
        if (hi.current > 0) {
          ctx.fillStyle = alpha(theme.palette.text.secondary, 0.2); ctx.font = '400 8px monospace';
          ctx.fillText('HI ' + String(hi.current).padStart(5, '0'), ox + gw - 4, 16);
        }
      }

      // Debug: show jump state (REMOVE AFTER CONFIRMING IT WORKS)
      if (gs.current === 'play') {
        ctx.fillStyle = jumpHeld ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.3)';
        ctx.beginPath(); ctx.arc(ox + 8, 8, 4, 0, Math.PI * 2); ctx.fill();
      }

      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(anim);
  }, [theme, die]);

  if (!vis) return null;

  return (
    <Box
      ref={boxRef}
      sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: ui === 'play' ? { xs: 80, md: 90 } : { xs: 24, md: 28 },
        zIndex: 30,
        bgcolor: ui === 'play' ? alpha(theme.palette.background.default, 0.94) : 'transparent',
        backdropFilter: ui === 'play' ? 'blur(10px)' : 'none',
        borderTop: ui === 'play' ? '1px solid' : 'none',
        borderColor: 'divider',
        overflow: 'hidden',
        transition: 'height 250ms ease, background-color 250ms ease',
        cursor: 'pointer',
      }}
      onMouseDown={pDown} onMouseUp={pUp}
      onTouchStart={pDown} onTouchEnd={pUp}
    >
      <canvas ref={canvasRef} data-jump="0" data-duck="0" style={{ display: 'block' }} />

      {ui !== 'play' && (
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" sx={{
            color: alpha(theme.palette.text.secondary, ui === 'idle' ? 0.2 : 0.4),
            fontSize: '0.6rem', letterSpacing: '0.08em', userSelect: 'none',
          }}>
            {ui === 'idle'
              ? 'press SPACE to play'
              : `score: ${uiSc}${uiHi > uiSc ? ` · best: ${uiHi}` : ' · new best!'} — space to retry`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
