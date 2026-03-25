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

  // Dot positions
  const dots: Record<number, Array<[number, number]>> = {
    1: [[0.5, 0.5]],
    2: [[0.27, 0.27], [0.73, 0.73]],
    3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
    6: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.5], [0.73, 0.5], [0.27, 0.73], [0.73, 0.73]],
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
  1: [-Math.PI / 2, 0, 0],   // tilt +Z face up
  2: [0, 0, 0],               // +Y already up
  3: [0, 0, Math.PI / 2],     // tilt +X face up
  4: [0, 0, -Math.PI / 2],    // tilt -X face up
  5: [Math.PI, 0, 0],         // flip to -Y up
  6: [Math.PI / 2, 0, 0],     // tilt -Z face up
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
    // Start rotation (random)
    startX: 0, startY: 0, startZ: 0,
    // End rotation (lands on face)
    endX: 0, endY: 0, endZ: 0,
    // Bounce
    settled: false,
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

      // Add 3-5 full spins per axis + random direction variety
      const spins = () => (Math.floor(Math.random() * 3) + 3) * Math.PI * 2;
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

    // Bounce: dice goes up then comes down
    const bounceT = t < 0.3
      ? Math.sin(t / 0.3 * Math.PI) * 1.2  // Launch up
      : t < 0.6
        ? Math.sin((t - 0.3) / 0.3 * Math.PI) * 0.4  // Small bounce
        : t < 0.8
          ? Math.sin((t - 0.6) / 0.2 * Math.PI) * 0.1  // Tiny bounce
          : 0;  // Settled
    meshRef.current.position.y = bounceT;

    // Done
    if (t >= 1 && !a.settled) {
      a.settled = true;
      a.active = false;

      // Determine which face is up from the final rotation
      const face = getFaceFromEuler(meshRef.current.rotation);
      onSettled(face);
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

/** Determine top face from current euler rotation */
function getFaceFromEuler(rotation: THREE.Euler): number {
  const quat = new THREE.Quaternion().setFromEuler(rotation);
  const up = new THREE.Vector3(0, 1, 0);

  const axes = [
    { dir: new THREE.Vector3(1, 0, 0), face: 3 },
    { dir: new THREE.Vector3(-1, 0, 0), face: 4 },
    { dir: new THREE.Vector3(0, 1, 0), face: 2 },
    { dir: new THREE.Vector3(0, -1, 0), face: 5 },
    { dir: new THREE.Vector3(0, 0, 1), face: 1 },
    { dir: new THREE.Vector3(0, 0, -1), face: 6 },
  ];

  let best = 1;
  let bestDot = -Infinity;
  for (const { dir, face } of axes) {
    const d = dir.clone().applyQuaternion(quat).dot(up);
    if (d > bestDot) { bestDot = d; best = face; }
  }
  return best;
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
        style={{ background: 'linear-gradient(180deg, #FDFAF6 0%, #EEEDF5 100%)' }}
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
