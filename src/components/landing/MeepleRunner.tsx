'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';

/**
 * Meeple Runner — Chrome Dino-style side-scroller.
 *
 * A little meeple runs along the bottom of the viewport.
 * Press UP/SPACE to jump, DOWN to duck under obstacles.
 * Obstacles are game-themed: dice, controllers, cards, chess pieces.
 * Click or tap to start. Speed increases over time.
 */

// ─── Config ──────────────────────────────────────────────────

const GROUND_Y = 40; // px from bottom of canvas
const MEEPLE_SIZE = 28;
const GRAVITY = 0.65;
const JUMP_FORCE = -12;
const DUCK_HEIGHT = 14; // smaller hitbox when ducking
const INITIAL_SPEED = 3;
const MAX_SPEED = 9;
const SPEED_INCREMENT = 0.002;
const OBSTACLE_INTERVAL_MIN = 60; // frames
const OBSTACLE_INTERVAL_MAX = 140;

type ObstacleType = 'ground' | 'air';

interface Obstacle {
  x: number;
  type: ObstacleType;
  emoji: string;
  width: number;
  height: number;
  y: number; // bottom offset
}

const GROUND_OBSTACLES = ['🎲', '♟️', '🏆', '🧩', '🎯'];
const AIR_OBSTACLES = ['🎮', '🃏', '🎰', '⭐'];

// ─── Component ───────────────────────────────────────────────

export default function MeepleRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();

  // Game state refs (not useState — need instant reads in animation loop)
  const gameState = useRef<'idle' | 'playing' | 'dead'>('idle');
  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const meepleY = useRef(0); // offset from ground
  const meepleVY = useRef(0);
  const isDucking = useRef(false);
  const obstacles = useRef<Obstacle[]>([]);
  const frameCount = useRef(0);
  const nextObstacleIn = useRef(80);

  // For re-rendering score display
  const [displayScore, setDisplayScore] = useState(0);
  const [displayHighScore, setDisplayHighScore] = useState(0);
  const [state, setState] = useState<'idle' | 'playing' | 'dead'>('idle');

  // Input tracking
  const keysDown = useRef(new Set<string>());

  const startGame = useCallback(() => {
    gameState.current = 'playing';
    setState('playing');
    scoreRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    meepleY.current = 0;
    meepleVY.current = 0;
    isDucking.current = false;
    obstacles.current = [];
    frameCount.current = 0;
    nextObstacleIn.current = 80;
  }, []);

  const jump = useCallback(() => {
    if (meepleY.current <= 0.1) {
      meepleVY.current = JUMP_FORCE;
    }
  }, []);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysDown.current.add(e.key);

      if (gameState.current === 'idle' || gameState.current === 'dead') {
        if (e.key === ' ' || e.key === 'ArrowUp') {
          e.preventDefault();
          startGame();
          return;
        }
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
      keysDown.current.delete(e.key);
      if (e.key === 'ArrowDown') {
        isDucking.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startGame, jump]);

  // Touch/click handling
  const handleInteract = useCallback(() => {
    if (gameState.current === 'idle' || gameState.current === 'dead') {
      startGame();
    } else if (gameState.current === 'playing') {
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
      if (!ctx) return;

      const w = canvas.width / 2;
      const h = canvas.height / 2;

      ctx.save();
      ctx.scale(2, 2);
      ctx.clearRect(0, 0, w, h);

      const groundLineY = h - GROUND_Y;

      // Draw ground line
      ctx.strokeStyle = alpha(theme.palette.divider, 0.3);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, groundLineY);
      ctx.lineTo(w, groundLineY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (gameState.current === 'playing') {
        frameCount.current++;

        // Increase speed
        speedRef.current = Math.min(MAX_SPEED, speedRef.current + SPEED_INCREMENT);

        // Update score
        scoreRef.current = Math.floor(frameCount.current / 6);
        if (frameCount.current % 12 === 0) {
          setDisplayScore(scoreRef.current);
        }

        // Physics: gravity + jump
        meepleVY.current += GRAVITY;
        meepleY.current -= meepleVY.current;
        if (meepleY.current < 0) {
          meepleY.current = 0;
          meepleVY.current = 0;
        }

        // Spawn obstacles
        nextObstacleIn.current--;
        if (nextObstacleIn.current <= 0) {
          const isAir = Math.random() < 0.3 && scoreRef.current > 10;
          const emojis = isAir ? AIR_OBSTACLES : GROUND_OBSTACLES;
          const emoji = emojis[Math.floor(Math.random() * emojis.length)];

          obstacles.current.push({
            x: w + 20,
            type: isAir ? 'air' : 'ground',
            emoji,
            width: 22,
            height: isAir ? 18 : 24,
            y: isAir ? 36 : 0,
          });

          nextObstacleIn.current = OBSTACLE_INTERVAL_MIN +
            Math.random() * (OBSTACLE_INTERVAL_MAX - OBSTACLE_INTERVAL_MIN) *
            (INITIAL_SPEED / speedRef.current);
        }

        // Move obstacles
        for (const obs of obstacles.current) {
          obs.x -= speedRef.current;
        }
        obstacles.current = obstacles.current.filter((o) => o.x > -40);

        // Collision detection
        const meepleX = 60;
        const meepleH = isDucking.current ? DUCK_HEIGHT : MEEPLE_SIZE;
        const meepleBottom = meepleY.current;
        const meepleTop = meepleBottom + meepleH;

        for (const obs of obstacles.current) {
          const obsLeft = obs.x;
          const obsRight = obs.x + obs.width;
          const obsBottom = obs.y;
          const obsTop = obs.y + obs.height;

          // AABB collision
          if (
            meepleX + MEEPLE_SIZE * 0.7 > obsLeft &&
            meepleX + 4 < obsRight &&
            meepleTop > obsBottom &&
            meepleBottom < obsTop
          ) {
            // Dead!
            gameState.current = 'dead';
            setState('dead');
            if (scoreRef.current > highScoreRef.current) {
              highScoreRef.current = scoreRef.current;
              setDisplayHighScore(scoreRef.current);
            }
            setDisplayScore(scoreRef.current);
            break;
          }
        }
      }

      // ─── Draw ──────────────────────────────

      // Draw meeple (simple character)
      const meepleX = 60;
      const meepleDrawY = groundLineY - meepleY.current;
      const ducking = isDucking.current && gameState.current === 'playing';

      ctx.font = `${ducking ? 18 : 24}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      // Running animation (alternate between two states)
      const runFrame = Math.floor(frameCount.current / 6) % 2;
      const meepleChar = gameState.current === 'dead' ? '😵' :
        ducking ? '🏃' :
        meepleY.current > 2 ? '🦘' :
        runFrame === 0 ? '🏃' : '🏃‍♂️';

      ctx.fillText(meepleChar, meepleX, meepleDrawY);

      // Draw obstacles
      for (const obs of obstacles.current) {
        ctx.font = `${obs.height}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(obs.emoji, obs.x + obs.width / 2, groundLineY - obs.y);
      }

      // Draw score
      ctx.font = '600 11px "DM Sans", sans-serif';
      ctx.fillStyle = theme.palette.text.secondary;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`${scoreRef.current}`, w - 12, 10);

      if (highScoreRef.current > 0) {
        ctx.fillStyle = alpha(theme.palette.text.secondary, 0.5);
        ctx.font = '500 9px "DM Sans", sans-serif';
        ctx.fillText(`HI ${highScoreRef.current}`, w - 12, 24);
      }

      // Draw state messages
      if (gameState.current === 'idle') {
        ctx.font = '600 12px "DM Sans", sans-serif';
        ctx.fillStyle = theme.palette.text.secondary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Press SPACE or tap to play', w / 2, h / 2 - 8);
        ctx.font = '500 9px "DM Sans", sans-serif';
        ctx.fillStyle = alpha(theme.palette.text.secondary, 0.6);
        ctx.fillText('↑ Jump  ·  ↓ Duck', w / 2, h / 2 + 10);
      }

      if (gameState.current === 'dead') {
        ctx.font = '700 14px "DM Sans", sans-serif';
        ctx.fillStyle = theme.palette.secondary.main;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', w / 2, h / 2 - 10);
        ctx.font = '500 10px "DM Sans", sans-serif';
        ctx.fillStyle = theme.palette.text.secondary;
        ctx.fillText('Press SPACE to retry', w / 2, h / 2 + 8);
      }

      ctx.restore();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [theme]);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: { xs: 80, md: 100 },
        zIndex: 10,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.default, 0.85),
        backdropFilter: 'blur(8px)',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
      onClick={handleInteract}
      onTouchStart={handleInteract}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </Box>
  );
}
