'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { RigidBody, Physics, CuboidCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

// ─── Dice face UV mapping ────────────────────────────────────

/**
 * Creates a texture for one face of the dice with dots.
 * Returns a canvas-based texture with proper pip layout.
 */
function createFaceTexture(value: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Face background
  ctx.fillStyle = '#F8F8FA';
  ctx.fillRect(0, 0, size, size);

  // Subtle border
  ctx.strokeStyle = '#D8D8E0';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  // Dot positions (as fraction of size)
  const positions: Record<number, Array<[number, number]>> = {
    1: [[0.5, 0.5]],
    2: [[0.28, 0.28], [0.72, 0.72]],
    3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.5], [0.72, 0.5], [0.28, 0.72], [0.72, 0.72]],
  };

  const dotRadius = size * 0.08;
  const dots = positions[value] ?? [];

  for (const [fx, fy] of dots) {
    const x = fx * size;
    const y = fy * size;
    ctx.beginPath();
    ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
    // Red center dot for 1, dark navy for all others
    ctx.fillStyle = value === 1 ? '#FF6D3F' : '#1A1A2E';
    ctx.fill();
    // Subtle shadow
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ─── Dice Mesh ───────────────────────────────────────────────

/**
 * The actual dice rigid body with physics.
 *
 * Three.js box face order: +X, -X, +Y, -Y, +Z, -Z
 * Standard dice: opposite faces sum to 7
 *   +X = 3, -X = 4, +Y = 2, -Y = 5, +Z = 1, -Z = 6
 */
function DiceBody({
  onSettled,
  rolling,
}: {
  onSettled: (value: number) => void;
  rolling: boolean;
}) {
  const rigidRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [textures, setTextures] = useState<THREE.CanvasTexture[]>([]);
  const settledFrames = useRef(0);
  const hasSettled = useRef(false);
  const lastRolling = useRef(false);

  // Create textures on mount (client-side only)
  useEffect(() => {
    // Face order for Three.js box: +X, -X, +Y, -Y, +Z, -Z
    // Standard dice mapping: 3, 4, 2, 5, 1, 6
    setTextures([
      createFaceTexture(3), // +X
      createFaceTexture(4), // -X
      createFaceTexture(2), // +Y (top when upright)
      createFaceTexture(5), // -Y
      createFaceTexture(1), // +Z (front when upright)
      createFaceTexture(6), // -Z
    ]);
  }, []);

  // Detect when rolling starts → apply force
  useEffect(() => {
    if (rolling && !lastRolling.current && rigidRef.current) {
      hasSettled.current = false;
      settledFrames.current = 0;

      const body = rigidRef.current;

      // Reset position
      body.setTranslation({ x: 0, y: 3, z: 0 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);

      // Wake up the body
      body.wakeUp();

      // Random impulse — throw the dice
      const fx = (Math.random() - 0.5) * 4;
      const fy = Math.random() * 2 + 3;
      const fz = (Math.random() - 0.5) * 4;
      body.applyImpulse({ x: fx, y: fy, z: fz }, true);

      // Random torque — spin it
      const tx = (Math.random() - 0.5) * 30;
      const ty = (Math.random() - 0.5) * 30;
      const tz = (Math.random() - 0.5) * 30;
      body.applyTorqueImpulse({ x: tx, y: ty, z: tz }, true);
    }
    lastRolling.current = rolling;
  }, [rolling]);

  // Check if dice has settled
  useFrame(() => {
    if (!rigidRef.current || hasSettled.current || !rolling) return;

    const body = rigidRef.current;
    const linvel = body.linvel();
    const angvel = body.angvel();

    const speed = Math.sqrt(linvel.x ** 2 + linvel.y ** 2 + linvel.z ** 2);
    const angSpeed = Math.sqrt(angvel.x ** 2 + angvel.y ** 2 + angvel.z ** 2);

    if (speed < 0.05 && angSpeed < 0.05) {
      settledFrames.current++;
      // Wait 30 frames of being still to confirm settled
      if (settledFrames.current > 30) {
        hasSettled.current = true;
        // Determine which face is up
        const value = getTopFace(body);
        onSettled(value);
      }
    } else {
      settledFrames.current = 0;
    }
  });

  if (textures.length === 0) return null;

  const materials = textures.map((tex, i) => (
    <meshStandardMaterial key={i} attach={`material-${i}`} map={tex} />
  ));

  return (
    <RigidBody
      ref={rigidRef}
      colliders="cuboid"
      restitution={0.3}
      friction={0.8}
      mass={1}
      position={[0, 3, 0]}
      linearDamping={0.5}
      angularDamping={0.3}
    >
      <RoundedBox ref={meshRef} args={[1, 1, 1]} radius={0.08} smoothness={4} castShadow receiveShadow>
        {materials}
      </RoundedBox>
    </RigidBody>
  );
}

/**
 * Determines which face of the dice is pointing up.
 * Checks which local axis is most aligned with world up (0,1,0).
 */
function getTopFace(body: RapierRigidBody): number {
  const rotation = body.rotation();
  const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);

  // Check each axis against world up
  const up = new THREE.Vector3(0, 1, 0);
  const axes = [
    { dir: new THREE.Vector3(1, 0, 0), face: 3 },   // +X
    { dir: new THREE.Vector3(-1, 0, 0), face: 4 },   // -X
    { dir: new THREE.Vector3(0, 1, 0), face: 2 },    // +Y
    { dir: new THREE.Vector3(0, -1, 0), face: 5 },   // -Y
    { dir: new THREE.Vector3(0, 0, 1), face: 1 },    // +Z
    { dir: new THREE.Vector3(0, 0, -1), face: 6 },   // -Z
  ];

  let bestFace = 1;
  let bestDot = -Infinity;

  for (const { dir, face } of axes) {
    const rotated = dir.clone().applyQuaternion(quat);
    const dot = rotated.dot(up);
    if (dot > bestDot) {
      bestDot = dot;
      bestFace = face;
    }
  }

  return bestFace;
}

// ─── Ground plane ────────────────────────────────────────────

function Ground() {
  return (
    <RigidBody type="fixed" position={[0, -0.5, 0]}>
      <CuboidCollider args={[10, 0.5, 10]} />
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[20, 1, 20]} />
        <meshStandardMaterial color="#E8E8EE" />
      </mesh>
    </RigidBody>
  );
}

// ─── Walls (invisible, keep dice in frame) ───────────────────

function Walls() {
  return (
    <>
      <RigidBody type="fixed" position={[3, 2, 0]}>
        <CuboidCollider args={[0.1, 4, 4]} />
      </RigidBody>
      <RigidBody type="fixed" position={[-3, 2, 0]}>
        <CuboidCollider args={[0.1, 4, 4]} />
      </RigidBody>
      <RigidBody type="fixed" position={[0, 2, 3]}>
        <CuboidCollider args={[4, 4, 0.1]} />
      </RigidBody>
      <RigidBody type="fixed" position={[0, 2, -3]}>
        <CuboidCollider args={[4, 4, 0.1]} />
      </RigidBody>
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface PhysicsDiceProps {
  rolling: boolean;
  onSettled: (value: number) => void;
}

export default function PhysicsDice({ rolling, onSettled }: PhysicsDiceProps) {
  return (
    <div style={{ width: '100%', height: 220, cursor: 'pointer' }}>
      <Canvas
        shadows
        camera={{ position: [0, 5, 5], fov: 40, near: 0.1, far: 100 }}
        style={{ borderRadius: 16, background: 'linear-gradient(180deg, #FDFAF6 0%, #E8E8EE 100%)' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[4, 8, 4]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-3, 5, -3]} intensity={0.4} />

        <Physics gravity={[0, -20, 0]}>
          <DiceBody rolling={rolling} onSettled={onSettled} />
          <Ground />
          <Walls />
        </Physics>
      </Canvas>
    </div>
  );
}
