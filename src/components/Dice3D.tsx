'use client';

import { useState, useRef } from 'react';
import Box from '@mui/material/Box';

/**
 * 3D CSS dice that tumbles realistically and lands on a random face.
 *
 * Uses a CSS 3D cube with 6 positioned faces. On roll, applies
 * multiple full rotations across X/Y/Z axes with a final offset
 * that ensures the target face ends up facing the viewer.
 *
 * Key details:
 * - No backface-visibility:hidden (all faces stay visible during tumble)
 * - Minimal border-radius so cube edges meet cleanly
 * - Each face is fully opaque so the cube looks solid
 * - Uses CSS keyframe animation for the wobble/bounce at the end
 */

const SIZE = 90;
const HALF = SIZE / 2;

// Dot positions for each face value
const DOTS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
};

// To show face N facing the camera, rotate the whole cube by these degrees.
// These are the FINAL resting rotations (no extra spins added yet).
const LAND_ON: Record<number, [number, number, number]> = {
  1: [0, 0, 0],           // front face → already facing camera
  2: [-90, 0, 0],         // top face → tilt forward
  3: [0, 90, 0],          // right face → rotate left
  4: [0, -90, 0],         // left face → rotate right
  5: [90, 0, 0],          // bottom face → tilt back
  6: [180, 0, 0],         // back face → flip over
};

function Face({ value, transform }: { value: number; transform: string }) {
  const dotColor = value === 1
    ? 'linear-gradient(135deg, #FF6D3F, #E85A2E)'
    : 'linear-gradient(135deg, #1A1A2E, #2D2B55)';

  return (
    <Box
      sx={{
        position: 'absolute',
        width: SIZE,
        height: SIZE,
        background: 'linear-gradient(145deg, #FAFAFA, #E8E8EE)',
        border: '1.5px solid #D0D0DA',
        borderRadius: '6px',
        transform,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {DOTS[value].map(([x, y], i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%,-50%)',
            width: SIZE * 0.16,
            height: SIZE * 0.16,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }}
        />
      ))}
    </Box>
  );
}

interface Dice3DProps {
  rolling: boolean;
  onRoll: () => void;
}

export default function Dice3D({ rolling, onRoll }: Dice3DProps) {
  const [rx, setRx] = useState(0);
  const [ry, setRy] = useState(0);
  const [rz, setRz] = useState(0);
  const [animating, setAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  function handleClick() {
    if (animating || rolling) return;

    // Pick a random face 1-6
    const face = Math.floor(Math.random() * 6) + 1;
    const [lx, ly, lz] = LAND_ON[face];

    // Add dramatic spins: 3-5 full rotations per axis, randomised direction
    const dirX = Math.random() > 0.5 ? 1 : -1;
    const dirY = Math.random() > 0.5 ? 1 : -1;
    const dirZ = Math.random() > 0.5 ? 1 : -1;
    const spinsX = (Math.floor(Math.random() * 3) + 3) * 360 * dirX;
    const spinsY = (Math.floor(Math.random() * 3) + 3) * 360 * dirY;
    const spinsZ = (Math.floor(Math.random() * 2) + 1) * 360 * dirZ;

    setRx(spinsX + lx);
    setRy(spinsY + ly);
    setRz(spinsZ + lz);
    setAnimating(true);

    // Fire the parent's onRoll
    onRoll();

    // Reset animating flag after spin completes
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setAnimating(false), 1400);
  }

  return (
    <Box
      onClick={handleClick}
      sx={{
        cursor: animating ? 'default' : 'pointer',
        perspective: '800px',
        perspectiveOrigin: '50% 30%',
        width: SIZE + 40,
        height: SIZE + 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mx: 'auto',
        userSelect: 'none',
        '&:hover .dice-cube': animating ? {} : {
          filter: 'drop-shadow(0 6px 16px rgba(91, 79, 219, 0.35))',
        },
      }}
    >
      <Box
        className="dice-cube"
        sx={{
          width: SIZE,
          height: SIZE,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
          transition: animating
            ? 'transform 1.3s cubic-bezier(0.15, 0.8, 0.25, 1)'
            : 'none',
          filter: animating
            ? 'drop-shadow(0 12px 28px rgba(91, 79, 219, 0.4))'
            : 'drop-shadow(0 4px 10px rgba(0,0,0,0.18))',
        }}
      >
        {/* Front  = 1 */}
        <Face value={1} transform={`translateZ(${HALF}px)`} />
        {/* Back   = 6 */}
        <Face value={6} transform={`rotateY(180deg) translateZ(${HALF}px)`} />
        {/* Top    = 2 */}
        <Face value={2} transform={`rotateX(90deg) translateZ(${HALF}px)`} />
        {/* Bottom = 5 */}
        <Face value={5} transform={`rotateX(-90deg) translateZ(${HALF}px)`} />
        {/* Right  = 3 */}
        <Face value={3} transform={`rotateY(90deg) translateZ(${HALF}px)`} />
        {/* Left   = 4 */}
        <Face value={4} transform={`rotateY(-90deg) translateZ(${HALF}px)`} />
      </Box>
    </Box>
  );
}
