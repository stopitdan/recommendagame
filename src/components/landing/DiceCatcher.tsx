'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Mini "Dice Catcher" game embedded in the hero section.
 * Dice fall from the top — click them to score points.
 * Missed dice disappear at the bottom. Simple, addictive, playful.
 */

interface FallingDice {
  id: number;
  x: number; // percentage from left
  face: string;
  speed: number; // px per frame
  y: number;
  caught: boolean;
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const SPECIAL_FACES = ['🎲', '💎', '⭐'];

export default function DiceCatcher() {
  const [dice, setDice] = useState<FallingDice[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [popups, setPopups] = useState<{ id: number; x: number; y: number; text: string }[]>([]);
  const nextId = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Spawn dice
  useEffect(() => {
    const interval = setInterval(() => {
      const isSpecial = Math.random() < 0.15;
      const newDice: FallingDice = {
        id: nextId.current++,
        x: 10 + Math.random() * 80,
        face: isSpecial
          ? SPECIAL_FACES[Math.floor(Math.random() * SPECIAL_FACES.length)]
          : DICE_FACES[Math.floor(Math.random() * DICE_FACES.length)],
        speed: 1.2 + Math.random() * 1.5,
        y: -30,
        caught: false,
      };
      setDice((prev) => [...prev.slice(-15), newDice]); // Max 15 on screen
    }, 800);

    return () => clearInterval(interval);
  }, []);

  // Animate falling
  useEffect(() => {
    const frame = () => {
      setDice((prev) =>
        prev
          .map((d) => (d.caught ? d : { ...d, y: d.y + d.speed }))
          .filter((d) => d.y < 110 || d.caught),
      );
      animRef.current = requestAnimationFrame(frame);
    };
    const animRef = { current: requestAnimationFrame(frame) };
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const catchDice = useCallback((diceId: number, face: string, clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const relX = rect ? clientX - rect.left : clientX;
    const relY = rect ? clientY - rect.top : clientY;

    const isSpecial = SPECIAL_FACES.includes(face);
    const points = isSpecial ? 5 : 1;
    const newCombo = combo + 1;

    setCombo(newCombo);
    setScore((prev) => {
      const newScore = prev + points * Math.min(newCombo, 5);
      if (newScore > highScore) setHighScore(newScore);
      return newScore;
    });

    setDice((prev) => prev.map((d) => d.id === diceId ? { ...d, caught: true } : d));

    // Score popup
    const popupText = isSpecial
      ? `+${points * Math.min(newCombo, 5)} BONUS!`
      : newCombo >= 3
        ? `+${points * Math.min(newCombo, 5)} x${Math.min(newCombo, 5)}!`
        : `+${points}`;

    setPopups((prev) => [...prev, { id: nextId.current++, x: relX, y: relY, text: popupText }]);

    // Remove popup after animation
    setTimeout(() => {
      setPopups((prev) => prev.slice(1));
    }, 800);

    // Remove caught dice after pop animation
    setTimeout(() => {
      setDice((prev) => prev.filter((d) => d.id !== diceId));
    }, 300);

    // Reset combo after 2s of no catches
    setTimeout(() => setCombo(0), 2000);
  }, [combo, highScore]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: { xs: 200, md: 280 },
        height: { xs: 200, md: 260 },
        borderRadius: 4,
        overflow: 'hidden',
        bgcolor: 'rgba(0,0,0,0.08)',
        backdropFilter: 'blur(4px)',
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'crosshair',
        userSelect: 'none',
      }}
    >
      {/* Score display */}
      <Box sx={{ position: 'absolute', top: 8, left: 12, zIndex: 10 }}>
        <Typography variant="caption" sx={{ fontWeight: 800, color: 'secondary.main', fontSize: '0.9rem' }}>
          {score}
        </Typography>
        {combo >= 3 && (
          <Typography variant="caption" sx={{ ml: 1, fontWeight: 700, color: 'warning.main', fontSize: '0.75rem' }}>
            x{Math.min(combo, 5)} COMBO
          </Typography>
        )}
      </Box>

      {/* High score */}
      {highScore > 0 && (
        <Box sx={{ position: 'absolute', top: 8, right: 12, zIndex: 10 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            Best: {highScore}
          </Typography>
        </Box>
      )}

      {/* Label */}
      <Box sx={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', opacity: 0.7 }}>
          Click the dice!
        </Typography>
      </Box>

      {/* Falling dice */}
      <AnimatePresence>
        {dice.map((d) => (
          <motion.div
            key={d.id}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={d.caught
              ? { scale: 1.5, opacity: 0, rotate: 360 }
              : { scale: 1, opacity: 1, rotate: d.y * 2 }
            }
            exit={{ scale: 0, opacity: 0 }}
            transition={d.caught ? { duration: 0.3 } : { duration: 0.1 }}
            onClick={(e) => !d.caught && catchDice(d.id, d.face, e.clientX, e.clientY)}
            style={{
              position: 'absolute',
              left: `${d.x}%`,
              top: `${d.y}%`,
              fontSize: SPECIAL_FACES.includes(d.face) ? 28 : 24,
              cursor: 'pointer',
              zIndex: 5,
              filter: SPECIAL_FACES.includes(d.face) ? 'drop-shadow(0 0 6px gold)' : 'none',
            }}
          >
            {d.face}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Score popups */}
      <AnimatePresence>
        {popups.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -40, scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            style={{
              position: 'absolute',
              left: p.x - 20,
              top: p.y - 10,
              pointerEvents: 'none',
              zIndex: 20,
              fontWeight: 900,
              fontSize: '1rem',
              color: p.text.includes('BONUS') ? '#FFD700' : '#FF6D3F',
              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          >
            {p.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </Box>
  );
}
