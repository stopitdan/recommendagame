'use client';

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 3D D20 with canvas-baked number textures and natural roll physics.
 *
 * Numbers are rendered via canvas textures on small planes at each
 * face center (lightweight, no font loading, no WebGL crash).
 *
 * Roll animation uses a single consistent momentum direction with
 * cubic ease-out for natural deceleration — like a real dice slowing
 * on a table. No mid-air direction changes.
 *
 * Landing uses actual icosahedron face normals so the die always
 * settles perfectly flat on a triangular face.
 */

// ─── Compute face data from icosahedron geometry ─────────────

interface FaceData {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  landingEuler: THREE.Euler;
}

function computeFaceData(): FaceData[] {
  const geo = new THREE.IcosahedronGeometry(0.85, 0);
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const faces: FaceData[] = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

    const center = a.clone().add(b).add(c).divideScalar(3);

    const normal = new THREE.Vector3()
      .crossVectors(b.clone().sub(a), c.clone().sub(a))
      .normalize();

    const quat = new THREE.Quaternion().setFromUnitVectors(normal, up);
    const euler = new THREE.Euler().setFromQuaternion(quat);

    faces.push({ center, normal, landingEuler: euler });
  }

  geo.dispose();
  return faces;
}

// ─── Create number texture via canvas ────────────────────────

function createNumberTexture(num: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  // White number with slight shadow for readability
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${num > 9 ? 48 : 56}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ─── Number labels on faces ──────────────────────────────────

function FaceLabels({ faces }: { faces: FaceData[] }) {
  const textures = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => createNumberTexture(i + 1)),
  []);

  return (
    <>
      {faces.map((face, i) => {
        const pos = face.center.clone().multiplyScalar(1.02);
        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal);

        return (
          <mesh key={i} position={pos} quaternion={quat}>
            <planeGeometry args={[0.38, 0.38]} />
            <meshBasicMaterial
              map={textures[i]}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </>
  );
}

// ─── Animated D20 ────────────────────────────────────────────

function AnimatedD20({
  rolling,
  onSettled,
}: {
  rolling: boolean;
  onSettled: (value: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const faces = useMemo(() => computeFaceData(), []);

  const anim = useRef({
    active: false,
    startTime: 0,
    duration: 2.2,
    // Start rotation (captured from current state)
    startX: 0, startY: 0, startZ: 0,
    // End rotation (landing face euler + whole rotations)
    endX: 0, endY: 0, endZ: 0,
    settled: false,
    targetValue: 1,
  });

  const lastRolling = useRef(false);

  useEffect(() => {
    if (rolling && !lastRolling.current) {
      const value = Math.floor(Math.random() * 20) + 1;
      const landing = faces[value - 1].landingEuler;

      const group = groupRef.current;
      const sx = group ? group.rotation.x : 0;
      const sy = group ? group.rotation.y : 0;
      const sz = group ? group.rotation.z : 0;

      // Pick a single momentum direction and stick with it.
      // This prevents the jarring mid-air direction changes.
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;
      const dirZ = dirX * dirY; // Derived, not random — keeps rotation coherent

      // Controlled spin amount: 1.5–2.5 full rotations on primary axes,
      // and less on the Z axis for natural tumble feel.
      const spinX = (1.5 + Math.random()) * Math.PI * 2 * dirX;
      const spinY = (1.5 + Math.random()) * Math.PI * 2 * dirY;
      const spinZ = (0.8 + Math.random() * 0.5) * Math.PI * 2 * dirZ;

      anim.current = {
        active: true,
        startTime: 0,
        duration: 2.0 + Math.random() * 0.4, // 2.0–2.4s — consistent pace
        startX: sx, startY: sy, startZ: sz,
        endX: landing.x + spinX,
        endY: landing.y + spinY,
        endZ: landing.z + spinZ,
        settled: false,
        targetValue: value,
      };
    }
    lastRolling.current = rolling;
  }, [rolling, faces]);

  useFrame(() => {
    const a = anim.current;
    if (!a.active || !groupRef.current) return;

    if (a.startTime === 0) a.startTime = performance.now();

    const elapsed = (performance.now() - a.startTime) / 1000;
    const t = Math.min(elapsed / a.duration, 1);

    // Cubic ease-out: fast start, smooth deceleration (like real friction)
    const ease = 1 - Math.pow(1 - t, 3);

    groupRef.current.rotation.x = a.startX + (a.endX - a.startX) * ease;
    groupRef.current.rotation.y = a.startY + (a.endY - a.startY) * ease;
    groupRef.current.rotation.z = a.startZ + (a.endZ - a.startZ) * ease;

    // Natural bounce: big initial toss, two smaller bounces, settle to 0
    let bounceY = 0;
    if (t < 0.25) {
      // Initial toss up
      bounceY = Math.sin((t / 0.25) * Math.PI) * 0.5;
    } else if (t < 0.45) {
      // First bounce
      bounceY = Math.sin(((t - 0.25) / 0.2) * Math.PI) * 0.18;
    } else if (t < 0.6) {
      // Second small bounce
      bounceY = Math.sin(((t - 0.45) / 0.15) * Math.PI) * 0.05;
    }
    groupRef.current.position.y = bounceY;

    if (t >= 1 && !a.settled) {
      a.settled = true;
      a.active = false;
      // Snap to exact landing position (remove any float drift)
      groupRef.current.position.y = 0;
      onSettled(a.targetValue);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <icosahedronGeometry args={[0.85, 0]} />
        <meshStandardMaterial
          color="#5B4FDB"
          metalness={0.3}
          roughness={0.4}
          flatShading
        />
      </mesh>
      <FaceLabels faces={faces} />
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
        camera={{ position: [0, 2.5, 3], fov: 40 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 3]} intensity={1.2} />
        <pointLight position={[-2, 3, -1]} intensity={0.3} color="#FF6D3F" />
        <AnimatedD20 rolling={rolling} onSettled={onSettled} />
      </Canvas>
    </div>
  );
}
