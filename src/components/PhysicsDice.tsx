'use client';

import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

/**
 * 3D D20 (icosahedron) dice that tumbles and lands on a random value 1-20.
 *
 * Uses Three.js IcosahedronGeometry for the die shape with a metallic
 * indigo material. Numbers are displayed as 3D text on the "landed" face
 * after the roll settles.
 *
 * The d20 shape is iconic in gaming (D&D) and perfect for a game
 * recommendation site.
 */

// ─── Landing rotations for each face ─────────────────────────
// Pre-computed euler angles that put each icosahedron face on top.
// An icosahedron has 20 triangular faces. We map values 1-20 to
// specific orientations. Since the exact face-to-rotation mapping
// is complex, we use 20 visually distinct rotations that each
// show the die at a different angle.

function generateLandingRotations(): Array<[number, number, number]> {
  // Generate 20 distinct resting orientations spread across the sphere
  const rotations: Array<[number, number, number]> = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < 20; i++) {
    const y = 1 - (i / 19) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    const rx = Math.acos(y);
    const ry = theta;
    const rz = (i * 0.7) % (Math.PI * 2);
    rotations.push([rx, ry, rz]);
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
  const textRef = useRef<any>(null);

  const anim = useRef({
    active: false,
    startTime: 0,
    duration: 2.0,
    startX: 0, startY: 0, startZ: 0,
    endX: 0, endY: 0, endZ: 0,
    settled: false,
    targetValue: 1,
  });

  const [displayValue, setDisplayValue] = useState<number | null>(null);

  // Start animation when rolling
  const lastRolling = useRef(false);
  useEffect(() => {
    if (rolling && !lastRolling.current) {
      const value = Math.floor(Math.random() * 20) + 1;
      const [ex, ey, ez] = LAND_ROTATIONS[value - 1];

      const mesh = meshRef.current;
      const sx = mesh ? mesh.rotation.x : 0;
      const sy = mesh ? mesh.rotation.y : 0;
      const sz = mesh ? mesh.rotation.z : 0;

      // 2-3 full spins per axis
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

      setDisplayValue(null);
    }
    lastRolling.current = rolling;
  }, [rolling]);

  useFrame(() => {
    const a = anim.current;
    if (!a.active || !meshRef.current) return;

    if (a.startTime === 0) a.startTime = performance.now();

    const elapsed = (performance.now() - a.startTime) / 1000;
    const t = Math.min(elapsed / a.duration, 1);

    // Cubic ease-out
    const ease = 1 - Math.pow(1 - t, 3);

    meshRef.current.rotation.x = a.startX + (a.endX - a.startX) * ease;
    meshRef.current.rotation.y = a.startY + (a.endY - a.startY) * ease;
    meshRef.current.rotation.z = a.startZ + (a.endZ - a.startZ) * ease;

    // Gentle bounce
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
      setDisplayValue(a.targetValue);
      onSettled(a.targetValue);
    }
  });

  return (
    <group>
      <mesh ref={meshRef} castShadow>
        <icosahedronGeometry args={[0.85, 0]} />
        <meshStandardMaterial
          color="#5B4FDB"
          metalness={0.3}
          roughness={0.4}
          flatShading
        />
      </mesh>

      {/* Floating number above the die after settling */}
      {displayValue !== null && (
        <Text
          ref={textRef}
          position={[0, 1.5, 0]}
          fontSize={0.6}
          fontWeight={800}
          color="#FF6D3F"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#FFFFFF"
        >
          {displayValue}
        </Text>
      )}
    </group>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface PhysicsDiceProps {
  rolling: boolean;
  onSettled: (value: number) => void;
}

export default function PhysicsDice({ rolling, onSettled }: PhysicsDiceProps) {
  return (
    <div style={{ width: '100%', height: 220, cursor: 'pointer', borderRadius: 16, overflow: 'hidden' }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [0, 2.5, 3], fov: 40 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 6, 3]} intensity={1.5} castShadow />
        <pointLight position={[-2, 3, -1]} intensity={0.4} color="#FF6D3F" />
        <pointLight position={[2, 3, 1]} intensity={0.3} color="#0EC6C6" />

        <AnimatedD20 rolling={rolling} onSettled={onSettled} />

        {/* Ground shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.86, 0]} receiveShadow>
          <planeGeometry args={[6, 6]} />
          <shadowMaterial opacity={0.12} />
        </mesh>
      </Canvas>
    </div>
  );
}
