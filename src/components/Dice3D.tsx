'use client';

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';

/**
 * 3D CSS dice that spins and lands on a random face (1-6).
 * Uses CSS 3D transforms for a realistic tumbling effect.
 */

const DICE_SIZE = 80;

// Each face rotation to show it on top
const FACE_ROTATIONS: Record<number, string> = {
  1: 'rotateX(0deg)',
  2: 'rotateX(-90deg)',
  3: 'rotateY(90deg)',
  4: 'rotateY(-90deg)',
  5: 'rotateX(90deg)',
  6: 'rotateX(180deg)',
};

// Dot positions for each face (as percentage of face size)
const DOT_LAYOUTS: Record<number, Array<{ top: string; left: string }>> = {
  1: [{ top: '50%', left: '50%' }],
  2: [{ top: '25%', left: '25%' }, { top: '75%', left: '75%' }],
  3: [{ top: '25%', left: '25%' }, { top: '50%', left: '50%' }, { top: '75%', left: '75%' }],
  4: [{ top: '25%', left: '25%' }, { top: '25%', left: '75%' }, { top: '75%', left: '25%' }, { top: '75%', left: '75%' }],
  5: [{ top: '25%', left: '25%' }, { top: '25%', left: '75%' }, { top: '50%', left: '50%' }, { top: '75%', left: '25%' }, { top: '75%', left: '75%' }],
  6: [{ top: '25%', left: '25%' }, { top: '25%', left: '75%' }, { top: '50%', left: '25%' }, { top: '50%', left: '75%' }, { top: '75%', left: '25%' }, { top: '75%', left: '75%' }],
};

interface Dice3DProps {
  rolling: boolean;
  onRoll: () => void;
  /** Which face to land on (1-6). Random if not specified. */
  result?: number;
}

function DiceFace({ number, transform }: { number: number; transform: string }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        width: DICE_SIZE,
        height: DICE_SIZE,
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F0F5 100%)',
        border: '2px solid #E0E0E8',
        borderRadius: '14px',
        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.06)',
        transform,
        backfaceVisibility: 'hidden',
      }}
    >
      {DOT_LAYOUTS[number].map((pos, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -50%)',
            width: DICE_SIZE * 0.18,
            height: DICE_SIZE * 0.18,
            borderRadius: '50%',
            background: number === 1
              ? 'linear-gradient(135deg, #FF6D3F, #E85A2E)'
              : 'linear-gradient(135deg, #1A1A2E, #2D2B55)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      ))}
    </Box>
  );
}

export default function Dice3D({ rolling, onRoll, result }: Dice3DProps) {
  const [currentResult, setCurrentResult] = useState(1);
  const [spinTransform, setSpinTransform] = useState('');

  const roll = useCallback(() => {
    if (rolling) return;

    const face = result ?? (Math.floor(Math.random() * 6) + 1);

    // Create a dramatic multi-axis spin that ends on the target face
    // Add multiple full rotations for dramatic effect
    const extraSpinsX = (Math.floor(Math.random() * 3) + 2) * 360;
    const extraSpinsY = (Math.floor(Math.random() * 3) + 2) * 360;
    const extraSpinsZ = (Math.floor(Math.random() * 2) + 1) * 360;

    // The final rotation to show the correct face
    const faceRotation = FACE_ROTATIONS[face];
    // Parse the target rotation
    const targetX = faceRotation.includes('rotateX')
      ? parseInt(faceRotation.match(/rotateX\((-?\d+)deg\)/)?.[1] ?? '0')
      : 0;
    const targetY = faceRotation.includes('rotateY')
      ? parseInt(faceRotation.match(/rotateY\((-?\d+)deg\)/)?.[1] ?? '0')
      : 0;

    setSpinTransform(
      `rotateX(${extraSpinsX + targetX}deg) rotateY(${extraSpinsY + targetY}deg) rotateZ(${extraSpinsZ}deg)`
    );

    setCurrentResult(face);
    onRoll();
  }, [rolling, result, onRoll]);

  return (
    <Box
      onClick={roll}
      sx={{
        cursor: rolling ? 'default' : 'pointer',
        perspective: '600px',
        width: DICE_SIZE + 20,
        height: DICE_SIZE + 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mx: 'auto',
        // Hover effect when not rolling
        transition: 'transform 200ms ease',
        '&:hover': rolling ? {} : { transform: 'scale(1.1)' },
        '&:active': rolling ? {} : { transform: 'scale(0.95)' },
      }}
    >
      <Box
        sx={{
          width: DICE_SIZE,
          height: DICE_SIZE,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: spinTransform || FACE_ROTATIONS[currentResult],
          transition: rolling
            ? 'transform 1.2s cubic-bezier(0.2, 0.8, 0.3, 1)'
            : 'none',
          // Subtle shadow that moves during spin
          filter: rolling ? 'drop-shadow(0 8px 20px rgba(91, 79, 219, 0.3))' : 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))',
        }}
      >
        {/* Face 1 - Front */}
        <DiceFace number={1} transform={`translateZ(${DICE_SIZE / 2}px)`} />
        {/* Face 6 - Back */}
        <DiceFace number={6} transform={`rotateX(180deg) translateZ(${DICE_SIZE / 2}px)`} />
        {/* Face 2 - Top */}
        <DiceFace number={2} transform={`rotateX(90deg) translateZ(${DICE_SIZE / 2}px)`} />
        {/* Face 5 - Bottom */}
        <DiceFace number={5} transform={`rotateX(-90deg) translateZ(${DICE_SIZE / 2}px)`} />
        {/* Face 3 - Left */}
        <DiceFace number={3} transform={`rotateY(-90deg) translateZ(${DICE_SIZE / 2}px)`} />
        {/* Face 4 - Right */}
        <DiceFace number={4} transform={`rotateY(90deg) translateZ(${DICE_SIZE / 2}px)`} />
      </Box>
    </Box>
  );
}
