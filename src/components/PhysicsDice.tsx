'use client';

import { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 3D D20 icosahedron that tumbles and lands.
 * Number displayed in 2D UI by parent (not on the 3D faces —
 * 3D text causes WebGL context loss on some systems).
 */

// ─── Landing rotations (20 distinct orientations) ────────────

function generateLandingRotations(): Array<[number, number, number]> {
  const rotations: Array<[number, number, number]> = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 20; i++) {
    const y = 1 - (i / 19) * 2;
    const theta = goldenAngle * i;
    rotations.push([Math.acos(y), theta, (i * 0.7) % (Math.PI * 2)]);
  }
  return rotations;
}

const LAND_ROTATIONS = generateLandingRotations();

// ─── Animated D20 ────────────────────────────────────────────

function AnimatedD20({
  rolling,
  onSettled,
}: {
  rolling: boolean;
  onSettled: (value: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const anim = useRef({
    active: false,
    startTime: 0,
    duration: 2.0,
    startX: 0, startY: 0, startZ: 0,
    endX: 0, endY: 0, endZ: 0,
    settled: false,
    targetValue: 1,
  });

  const lastRolling = useRef(false);
  useEffect(() => {
    if (rolling && !lastRolling.current) {
      const value = Math.floor(Math.random() * 20) + 1;
      const [ex, ey, ez] = LAND_ROTATIONS[value - 1];

      const mesh = meshRef.current;
      const sx = mesh ? mesh.rotation.x : 0;
      const sy = mesh ? mesh.rotation.y : 0;
      const sz = mesh ? mesh.rotation.z : 0;

      const spins = () => (Math.floor(Math.random() * 2) + 2) * Math.PI * 2;
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;

      anim.current = {
        active: true,
        startTime: 0,
        duration: 2.0,
        startX: sx, startY: sy, startZ: sz,
        endX: ex + spins() * dirX,
        endY: ey + spins() * dirY,
        endZ: ez + spins() * dirX * dirY,
        settled: false,
        targetValue: value,
      };
    }
    lastRolling.current = rolling;
  }, [rolling]);

  useFrame(() => {
    const a = anim.current;
    if (!a.active || !meshRef.current) return;

    if (a.startTime === 0) a.startTime = performance.now();

    const elapsed = (performance.now() - a.startTime) / 1000;
    const t = Math.min(elapsed / a.duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);

    meshRef.current.rotation.x = a.startX + (a.endX - a.startX) * ease;
    meshRef.current.rotation.y = a.startY + (a.endY - a.startY) * ease;
    meshRef.current.rotation.z = a.startZ + (a.endZ - a.startZ) * ease;

    // Bounce
    const bounceT = t < 0.3
      ? Math.sin(t / 0.3 * Math.PI) * 0.6
      : t < 0.55
        ? Math.sin((t - 0.3) / 0.25 * Math.PI) * 0.2
        : t < 0.75
          ? Math.sin((t - 0.55) / 0.2 * Math.PI) * 0.06
          : 0;
    meshRef.current.position.y = bounceT;

    if (t >= 1 && !a.settled) {
      a.settled = true;
      a.active = false;
      onSettled(a.targetValue);
    }
  });

  return (
    <mesh ref={meshRef} castShadow>
      <icosahedronGeometry args={[0.85, 0]} />
      <meshStandardMaterial
        color="#5B4FDB"
        metalness={0.3}
        roughness={0.4}
        flatShading
      />
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
        camera={{ position: [0, 2.5, 3], fov: 40 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true, powerPreference: 'default' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 3]} intensity={1.2} />
        <pointLight position={[-2, 3, -1]} intensity={0.3} color="#FF6D3F" />

        <AnimatedD20 rolling={rolling} onSettled={onSettled} />
      </Canvas>
    </div>
  );
}
