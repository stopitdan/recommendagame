'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';

const LS_KEY = 'rag_runner_hi';

// Module-level input — no React closure issues
let JUMP_DOWN = false;
let DUCK_DOWN = false;

// Physics
const BALL_R = 6;
const JUMP_V = -3.2;
const G_HOLD = 0.03;   // gravity while holding jump + rising
const G_RISE = 0.12;   // gravity rising, released
const G_FALL = 0.18;   // gravity falling
const SPD0 = 1.2;
const SPD_MAX = 3.5;
const SPD_INC = 0.00025;
const GAME_W = 460;
const GND_PAD = 8;     // ground line from canvas bottom

export default function MeepleRunner() {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  const gs = useRef<'idle' | 'play' | 'dead'>('idle');
  const sc = useRef(0); const hi = useRef(0);
  const spd = useRef(SPD0);
  const py = useRef(0); const vy = useRef(0);
  const sqT = useRef(0);
  const spikes = useRef<{ x: number; gnd: boolean; w: number; h: number }[]>([]);
  const fr = useRef(0); const nxt = useRef(40);

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

  const start = useCallback(() => {
    gs.current = 'play'; setUi('play');
    sc.current = 0; spd.current = SPD0;
    py.current = 0; vy.current = 0;
    JUMP_DOWN = false; DUCK_DOWN = false;
    sqT.current = 0; spikes.current = [];
    fr.current = 0; nxt.current = 40; setUiSc(0);
  }, []);

  const die = useCallback(() => {
    gs.current = 'dead'; setUi('dead'); setUiSc(sc.current);
    if (sc.current > hi.current) { hi.current = sc.current; setUiHi(sc.current); try { localStorage.setItem(LS_KEY, String(sc.current)); } catch {} }
  }, []);

  // Keyboard
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault(); JUMP_DOWN = true;
        if (gs.current !== 'play') start();
        else if (!e.repeat && py.current < 0.3) vy.current = JUMP_V;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); DUCK_DOWN = true; }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') JUMP_DOWN = false;
      if (e.key === 'ArrowDown') DUCK_DOWN = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [start]);

  const pDown = useCallback(() => {
    JUMP_DOWN = true;
    if (gs.current !== 'play') start();
    else if (py.current < 0.3) vy.current = JUMP_V;
  }, [start]);
  const pUp = useCallback(() => { JUMP_DOWN = false; }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;

    const sync = () => {
      // Match canvas pixel size to EXACT box dimensions
      const rect = box.getBoundingClientRect();
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      canvas.width = Math.round(rect.width * devicePixelRatio);
      canvas.height = Math.round(rect.height * devicePixelRatio);
    };
    sync();
    window.addEventListener('resize', sync);
    let anim: number;

    const loop = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { anim = requestAnimationFrame(loop); return; }
      const dpr = devicePixelRatio;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const gw = Math.min(w - 20, GAME_W);
      const ox = (w - gw) / 2;
      const gnd = h - GND_PAD;
      const playH = gnd - 2; // usable height
      const bx = ox + 30;

      // Ground line
      ctx.strokeStyle = alpha(theme.palette.divider, 0.12);
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(ox, gnd); ctx.lineTo(ox + gw, gnd); ctx.stroke();

      if (gs.current === 'play') {
        fr.current++;
        spd.current = Math.min(SPD_MAX, spd.current + SPD_INC);
        sc.current = Math.floor(fr.current / 10);
        if (fr.current % 10 === 0) setUiSc(sc.current);

        // ═══ PHYSICS ═══
        const rising = vy.current < 0;
        const g = rising ? (JUMP_DOWN ? G_HOLD : G_RISE) : G_FALL;
        vy.current += g;
        py.current -= vy.current;
        if (py.current < 0) { if (vy.current > 0.2) sqT.current = 6; py.current = 0; vy.current = 0; }
        if (py.current > playH - BALL_R * 2) { py.current = playH - BALL_R * 2; if (vy.current < 0) vy.current = 0; }
        if (sqT.current > 0) sqT.current--;

        // Spikes
        nxt.current -= spd.current;
        if (nxt.current <= 0) {
          const ceil = Math.random() < 0.18 && sc.current > 20;
          spikes.current.push({
            x: gw + 5,
            gnd: !ceil,
            w: 5 + Math.random() * 4,
            h: ceil ? playH * (0.5 + Math.random() * 0.15) : 5 + Math.random() * BALL_R * 2,
          });
          nxt.current = 45 + Math.random() * 120;
        }
        for (const s of spikes.current) s.x -= spd.current;
        spikes.current = spikes.current.filter(s => s.x > -10);

        // Collision
        const duck = DUCK_DOWN && py.current < 0.5;
        const eH = duck ? BALL_R * 0.6 : BALL_R * 2;
        const lx = 30;
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
        else { ctx.moveTo(sx, 2); ctx.lineTo(sx + s.w / 2, 2 + s.h); ctx.lineTo(sx + s.w, 2); }
        ctx.closePath(); ctx.fill();
      }

      // Ball — CIRCLE by default
      const by = gnd - py.current;
      const duck = DUCK_DOWN && py.current < 0.5 && gs.current === 'play';
      const sq = sqT.current > 0;
      let rx = BALL_R, ry = BALL_R;
      if (duck) { rx = BALL_R * 1.3; ry = BALL_R * 0.4; }
      else if (sq) { const t = sqT.current / 6; rx = BALL_R * (1 + t * 0.25); ry = BALL_R * (1 - t * 0.2); }

      // Shadow
      ctx.fillStyle = alpha(theme.palette.text.primary, 0.03);
      ctx.beginPath(); ctx.ellipse(bx, gnd, rx * 0.4, 0.8, 0, 0, Math.PI * 2); ctx.fill();

      // Body
      const gr = ctx.createRadialGradient(bx - rx * 0.15, by - ry * 0.3, 0, bx, by - ry * 0.5, Math.max(rx, ry));
      gr.addColorStop(0, theme.palette.secondary.main);
      gr.addColorStop(1, theme.palette.secondary.dark ?? theme.palette.secondary.main);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(bx, by - ry, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.ellipse(bx - rx * 0.12, by - ry * 1.15, rx * 0.15, ry * 0.1, 0, 0, Math.PI * 2); ctx.fill();

      // Eye
      if (gs.current !== 'dead') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(bx + rx * 0.2, by - ry, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = theme.palette.text.primary;
        ctx.beginPath(); ctx.arc(bx + rx * 0.3, by - ry, 0.7, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = theme.palette.text.primary; ctx.lineWidth = 0.8;
        const ex = bx + rx * 0.2, ey = by - ry;
        ctx.beginPath(); ctx.moveTo(ex - 1.5, ey - 1.5); ctx.lineTo(ex + 1.5, ey + 1.5); ctx.moveTo(ex + 1.5, ey - 1.5); ctx.lineTo(ex - 1.5, ey + 1.5); ctx.stroke();
      }

      // Score
      if (gs.current === 'play') {
        ctx.font = '600 8px monospace'; ctx.fillStyle = alpha(theme.palette.text.secondary, 0.4);
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(String(sc.current).padStart(5, '0'), ox + gw - 2, 1);
        if (hi.current > 0) { ctx.fillStyle = alpha(theme.palette.text.secondary, 0.2); ctx.font = '400 6px monospace'; ctx.fillText('HI ' + String(hi.current).padStart(5, '0'), ox + gw - 2, 10); }
      }

      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', sync); };
  }, [theme, die]);

  if (!vis) return null;

  return (
    <Box
      ref={boxRef}
      sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: ui === 'play' ? { xs: 50, md: 56 } : { xs: 22, md: 24 },
        zIndex: 30,
        bgcolor: ui === 'play' ? alpha(theme.palette.background.default, 0.93) : 'transparent',
        backdropFilter: ui === 'play' ? 'blur(8px)' : 'none',
        borderTop: ui === 'play' ? '1px solid' : 'none',
        borderColor: 'divider',
        overflow: 'hidden',
        transition: 'height 200ms ease, background-color 200ms ease',
        cursor: 'pointer',
      }}
      onMouseDown={pDown} onMouseUp={pUp}
      onTouchStart={pDown} onTouchEnd={pUp}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />

      {ui !== 'play' && (
        <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" sx={{ color: alpha(theme.palette.text.secondary, ui === 'idle' ? 0.2 : 0.35), fontSize: '0.58rem', letterSpacing: '0.08em', userSelect: 'none' }}>
            {ui === 'idle'
              ? 'press SPACE to play'
              : `score: ${uiSc}${uiHi > uiSc ? ` · best: ${uiHi}` : ' · new best!'} — space to retry`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
