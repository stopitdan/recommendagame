'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import { useTheme, alpha } from '@mui/material/styles';

const HISCORE_KEY = 'rag_meeple_hiscore';

/**
 * Meeple Runner — Chrome Dino-style side-scroller.
 *
 * Sits at the bottom of the landing page. Click/tap or press SPACE to start.
 * Once playing, the bar becomes fixed so you can play while scrolling.
 * When idle or dead, it scrolls with the page like normal content.
 *
 * UP/SPACE = jump, DOWN = duck. Obstacles are game-themed emojis.
 * Speed gradually increases. Score tracked.
 */

// ─── Config (tuned for smooth, enjoyable gameplay) ───────────

const GROUND_Y = 32;
const GRAVITY = 0.45; // gentler gravity = floatier jumps
const JUMP_FORCE = -9.5; // lower = not too snappy
const INITIAL_SPEED = 1.8; // slow start
const MAX_SPEED = 5.5; // reasonable max
const SPEED_INCREMENT = 0.0008; // very gradual ramp

// Obstacle spacing — wide variance for unpredictable rhythm
const GAP_MIN = 90;
const GAP_MAX = 260;

const GROUND_OBSTACLES = ['🎲', '♟️', '🏆', '🧩', '🎯', '🎳'];
const AIR_OBSTACLES = ['🎮', '🃏', '⭐', '🕹️'];

interface Obstacle {
  x: number;
  type: 'ground' | 'air';
  emoji: string;
  width: number;
  height: number;
  y: number;
}

export default function MeepleRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  const gameState = useRef<'idle' | 'playing' | 'dead'>('idle');
  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const meepleY = useRef(0);
  const meepleVY = useRef(0);
  const isDucking = useRef(false);
  const obstacles = useRef<Obstacle[]>([]);
  const frameCount = useRef(0);
  const nextObstacleIn = useRef(120);

  const [isPlaying, setIsPlaying] = useState(false);

  // Load high score from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISCORE_KEY);
      if (saved) highScoreRef.current = parseInt(saved, 10) || 0;
    } catch {}
  }, []);

  const startGame = useCallback(() => {
    gameState.current = 'playing';
    setIsPlaying(true);
    scoreRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    meepleY.current = 0;
    meepleVY.current = 0;
    isDucking.current = false;
    obstacles.current = [];
    frameCount.current = 0;
    nextObstacleIn.current = 120;
  }, []);

  const die = useCallback(() => {
    gameState.current = 'dead';
    setIsPlaying(false);
    if (scoreRef.current > highScoreRef.current) {
      highScoreRef.current = scoreRef.current;
      // Persist high score to localStorage
      try { localStorage.setItem(HISCORE_KEY, String(highScoreRef.current)); } catch {}
    }
  }, []);

  const jump = useCallback(() => {
    if (meepleY.current <= 0.1) {
      meepleVY.current = JUMP_FORCE;
    }
  }, []);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.current === 'idle' || gameState.current === 'dead') {
        if (e.key === ' ' || e.key === 'ArrowUp') {
          e.preventDefault();
          startGame();
        }
        return;
      }
      if (gameState.current === 'playing') {
        if (e.key === 'ArrowUp' || e.key === ' ') {
          e.preventDefault();
          jump();
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          isDucking.current = true;
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') isDucking.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startGame, jump]);

  const handleInteract = useCallback(() => {
    if (gameState.current === 'idle' || gameState.current === 'dead') {
      startGame();
    } else {
      jump();
    }
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

      const groundLineY = h - GROUND_Y;

      // Ground line
      ctx.strokeStyle = alpha(theme.palette.divider, 0.25);
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, groundLineY);
      ctx.lineTo(w, groundLineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // ─── Update (only when playing) ───
      if (gameState.current === 'playing') {
        frameCount.current++;
        speedRef.current = Math.min(MAX_SPEED, speedRef.current + SPEED_INCREMENT);
        scoreRef.current = Math.floor(frameCount.current / 8);

        // Physics
        meepleVY.current += GRAVITY;
        meepleY.current -= meepleVY.current;
        if (meepleY.current < 0) {
          meepleY.current = 0;
          meepleVY.current = 0;
        }

        // Spawn obstacles with randomized gaps
        nextObstacleIn.current--;
        if (nextObstacleIn.current <= 0) {
          const isAir = Math.random() < 0.25 && scoreRef.current > 15;
          const emojis = isAir ? AIR_OBSTACLES : GROUND_OBSTACLES;

          obstacles.current.push({
            x: w + 30,
            type: isAir ? 'air' : 'ground',
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
            width: 20,
            height: isAir ? 16 : 22,
            y: isAir ? 30 : 0,
          });

          // Random gap — wider variance for interesting rhythm
          nextObstacleIn.current = GAP_MIN +
            Math.random() * (GAP_MAX - GAP_MIN) *
            Math.max(0.5, INITIAL_SPEED / speedRef.current);
        }

        // Move obstacles
        for (const obs of obstacles.current) obs.x -= speedRef.current;
        obstacles.current = obstacles.current.filter((o) => o.x > -40);

        // Collision
        const mx = 50;
        const mh = isDucking.current ? 12 : 22;
        const mBottom = meepleY.current;
        const mTop = mBottom + mh;

        for (const obs of obstacles.current) {
          if (
            mx + 16 > obs.x &&
            mx + 4 < obs.x + obs.width &&
            mTop > obs.y &&
            mBottom < obs.y + obs.height
          ) {
            die();
            break;
          }
        }
      }

      // ─── Draw ───

      const mx = 50;
      const mDrawY = groundLineY - meepleY.current;
      const ducking = isDucking.current && gameState.current === 'playing';

      // Meeple character — mirrored to face right using canvas transform
      ctx.save();
      ctx.translate(mx, 0);
      ctx.scale(-1, 1); // flip horizontally so runner faces right

      ctx.font = `${ducking ? 16 : 22}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      const runFrame = Math.floor(frameCount.current / 8) % 2;
      const char = gameState.current === 'dead' ? '😵'
        : ducking ? '🏃'
        : meepleY.current > 2 ? '🦘'
        : runFrame === 0 ? '🏃' : '🏃‍♂️';

      ctx.fillText(char, 0, mDrawY);
      ctx.restore();

      // Obstacles
      for (const obs of obstacles.current) {
        ctx.font = `${obs.height}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(obs.emoji, obs.x + obs.width / 2, groundLineY - obs.y);
      }

      // Score (top right)
      ctx.font = '600 11px "DM Sans", sans-serif';
      ctx.fillStyle = theme.palette.text.secondary;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`${scoreRef.current}`, w - 12, 8);

      if (highScoreRef.current > 0) {
        ctx.fillStyle = alpha(theme.palette.text.secondary, 0.4);
        ctx.font = '500 9px "DM Sans", sans-serif';
        ctx.fillText(`HI ${highScoreRef.current}`, w - 12, 22);
      }

      // Idle / dead messages
      if (gameState.current === 'idle') {
        ctx.font = '600 11px "DM Sans", sans-serif';
        ctx.fillStyle = theme.palette.text.secondary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Press SPACE or tap to play', w / 2, h / 2 - 6);
        ctx.font = '400 9px "DM Sans", sans-serif';
        ctx.fillStyle = alpha(theme.palette.text.secondary, 0.5);
        ctx.fillText('↑ Jump  ·  ↓ Duck', w / 2, h / 2 + 10);
      }

      if (gameState.current === 'dead') {
        ctx.font = '700 13px "DM Sans", sans-serif';
        ctx.fillStyle = theme.palette.secondary.main;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', w / 2, h / 2 - 8);
        ctx.font = '400 9px "DM Sans", sans-serif';
        ctx.fillStyle = theme.palette.text.secondary;
        ctx.fillText(`Score: ${scoreRef.current}  ·  SPACE to retry`, w / 2, h / 2 + 8);
      }

      ctx.restore();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [theme, die]);

  return (
    <Box
      sx={{
        // Fixed only while actively playing — otherwise scrolls with page
        position: isPlaying ? 'fixed' : 'relative',
        bottom: isPlaying ? 0 : 'auto',
        left: 0,
        right: 0,
        height: { xs: 80, md: 90 },
        zIndex: isPlaying ? 50 : 1,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.default, isPlaying ? 0.92 : 0.6),
        backdropFilter: isPlaying ? 'blur(12px)' : 'blur(4px)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'background-color 300ms ease',
      }}
      onClick={handleInteract}
      onTouchStart={handleInteract}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Box>
  );
}
