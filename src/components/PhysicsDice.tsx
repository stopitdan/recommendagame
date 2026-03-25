'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

// ─── Face textures ───────────────────────────────────────────

function createFaceTexture(value: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // White face
  ctx.fillStyle = '#F5F5F8';
  ctx.fillRect(0, 0, size, size);

  // Dot positions — centered with even margins
  const a = 0.3;  // inner offset from edge
  const b = 0.5;  // center
  const c = 0.7;  // opposite inner offset
  const dots: Record<number, Array<[number, number]>> = {
    1: [[b, b]],
    2: [[a, a], [c, c]],
    3: [[a, a], [b, b], [c, c]],
    4: [[a, a], [c, a], [a, c], [c, c]],
    5: [[a, a], [c, a], [b, b], [a, c], [c, c]],
    6: [[a, a], [c, a], [a, b], [c, b], [a, c], [c, c]],
  };

  const r = size * 0.075;
  for (const [fx, fy] of dots[value]) {
    ctx.beginPath();
    ctx.arc(fx * size, fy * size, r, 0, Math.PI * 2);
    ctx.fillStyle = value === 1 ? '#FF6D3F' : '#1A1A2E';
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ─── Target rotations to land each face on top ──────────────

// When the dice is at this euler rotation, the given face points UP (+Y)
// Three.js box: +X=right, -X=left, +Y=top, -Y=bottom, +Z=front, -Z=back
// Our mapping: +X=3, -X=4, +Y=2, -Y=5, +Z=1, -Z=6
const LAND_EULER: Record<number, [number, number, number]> = {
  1: [-Math.PI / 2, 0, 0],    // +Z (face 1) rotated to point up
  2: [0, 0, 0],                // +Y (face 2) already up
  3: [0, 0, -Math.PI / 2],    // +X (face 3) rotated to point up
  4: [0, 0, Math.PI / 2],     // -X (face 4) rotated to point up
  5: [Math.PI, 0, 0],         // -Y (face 5) flipped to point up
  6: [Math.PI / 2, 0, 0],     // -Z (face 6) rotated to point up
};

// ─── Animated Dice ───────────────────────────────────────────

function AnimatedDice({ rolling, onSettled }: { rolling: boolean; onSettled: (v: number) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [textures, setTextures] = useState<THREE.CanvasTexture[]>([]);

  // Animation state
  const anim = useRef({
    active: false,
    startTime: 0,
    duration: 1.8,
    startX: 0, startY: 0, startZ: 0,
    endX: 0, endY: 0, endZ: 0,
    settled: false,
    targetFace: 1,  // The face we chose to land on
  });

  // Create textures on mount
  useEffect(() => {
    // +X=3, -X=4, +Y=2, -Y=5, +Z=1, -Z=6
    setTextures([
      createFaceTexture(3),
      createFaceTexture(4),
      createFaceTexture(2),
      createFaceTexture(5),
      createFaceTexture(1),
      createFaceTexture(6),
    ]);
  }, []);

  // Start animation when rolling changes to true
  const lastRolling = useRef(false);
  useEffect(() => {
    if (rolling && !lastRolling.current) {
      const face = Math.floor(Math.random() * 6) + 1;
      const [ex, ey, ez] = LAND_EULER[face];

      // Current rotation as start
      const mesh = meshRef.current;
      const sx = mesh ? mesh.rotation.x : 0;
      const sy = mesh ? mesh.rotation.y : 0;
      const sz = mesh ? mesh.rotation.z : 0;

      // Add 2-3 full spins per axis — gentle but visible tumble
      const spins = () => (Math.floor(Math.random() * 2) + 2) * Math.PI * 2;
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;

      anim.current = {
        active: true,
        startTime: 0,
        duration: 1.8,
        startX: sx,
        startY: sy,
        startZ: sz,
        endX: ex + spins() * dirX,
        endY: ey + spins() * dirY,
        endZ: ez + spins() * dirX * dirY,
        settled: false,
        targetFace: face,
      };
    }
    lastRolling.current = rolling;
  }, [rolling]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a.active || !meshRef.current) return;

    if (a.startTime === 0) a.startTime = performance.now();

    const elapsed = (performance.now() - a.startTime) / 1000;
    const t = Math.min(elapsed / a.duration, 1);

    // Easing: fast start, slow settle (cubic ease-out)
    const ease = 1 - Math.pow(1 - t, 3);

    // Interpolate rotation
    meshRef.current.rotation.x = a.startX + (a.endX - a.startX) * ease;
    meshRef.current.rotation.y = a.startY + (a.endY - a.startY) * ease;
    meshRef.current.rotation.z = a.startZ + (a.endZ - a.startZ) * ease;

    // Bounce: dice goes up then comes down — gentle arc
    const bounceT = t < 0.3
      ? Math.sin(t / 0.3 * Math.PI) * 0.8   // Launch up
      : t < 0.6
        ? Math.sin((t - 0.3) / 0.3 * Math.PI) * 0.25  // Small bounce
        : t < 0.8
          ? Math.sin((t - 0.6) / 0.2 * Math.PI) * 0.08  // Tiny bounce
          : 0;  // Settled
    meshRef.current.position.y = bounceT;

    // Done
    if (t >= 1 && !a.settled) {
      a.settled = true;
      a.active = false;

      // Report the face we chose to land on
      onSettled(a.targetFace);
    }
  });

  if (textures.length === 0) return null;

  return (
    <mesh ref={meshRef} castShadow>
      <RoundedBox args={[1, 1, 1]} radius={0.08} smoothness={4}>
        {textures.map((tex, i) => (
          <meshStandardMaterial key={i} attach={`material-${i}`} map={tex} />
        ))}
      </RoundedBox>
    </mesh>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface PhysicsDiceProps {
  rolling: boolean;
  onSettled: (value: number) => void;
}

export default function PhysicsDice({ rolling, onSettled }: PhysicsDiceProps) {
  return (
    <div style={{ width: '100%', height: 200, cursor: 'pointer', borderRadius: 16, overflow: 'hidden' }}>
      <Canvas
        shadows
        camera={{ position: [0, 3, 3.5], fov: 35 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 6, 3]} intensity={1.5} castShadow />
        <pointLight position={[-2, 4, -2]} intensity={0.3} color="#FF6D3F" />

        <AnimatedDice rolling={rolling} onSettled={onSettled} />

        {/* Ground shadow catcher */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.51, 0]} receiveShadow>
          <planeGeometry args={[8, 8]} />
          <shadowMaterial opacity={0.15} />
        </mesh>
      </Canvas>
    </div>
  );
}
