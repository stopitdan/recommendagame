'use client';

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 3D D20 with canvas-baked number textures and proper flat landing.
 *
 * Numbers are rendered via canvas textures on small planes at each
 * face center (lightweight, no font loading, no WebGL crash).
 *
 * Landing uses actual icosahedron face normals so the die always
 * settles perfectly flat on a triangular face.
 */

// ─── Compute face data from icosahedron geometry ─────────────

interface FaceData {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  // Euler rotation that puts this face's normal pointing straight up (+Y)
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

    // Face normal (cross product of two edges)
    const normal = new THREE.Vector3()
      .crossVectors(b.clone().sub(a), c.clone().sub(a))
      .normalize();

    // To land flat on this face: rotate so this normal points UP
    // We need the INVERSE rotation — rotate the die so the face normal aligns with +Y
    const quat = new THREE.Quaternion().setFromUnitVectors(normal, up);
    const euler = new THREE.Euler().setFromQuaternion(quat);

    faces.push({ center, normal, landingEuler: euler });
  }

  geo.dispose();
  return faces;
}

// ─── Create number texture via canvas ────────────────────────

function createNumberTexture(num: number): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  // Draw number
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${num > 9 ? 28 : 32}px Arial, sans-serif`;
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
        // Position slightly above face surface
        const pos = face.center.clone().multiplyScalar(1.02);

        // Orient the plane to face outward along the face normal
        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal);

        return (
          <mesh key={i} position={pos} quaternion={quat}>
            <planeGeometry args={[0.35, 0.35]} />
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
      const landing = faces[value - 1].landingEuler;

      const group = groupRef.current;
      const sx = group ? group.rotation.x : 0;
      const sy = group ? group.rotation.y : 0;
      const sz = group ? group.rotation.z : 0;

      // 2-3 full spins + land on the target face's euler
      const spins = () => (Math.floor(Math.random() * 2) + 2) * Math.PI * 2;
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;

      anim.current = {
        active: true,
        startTime: 0,
        duration: 2.0,
        startX: sx, startY: sy, startZ: sz,
        endX: landing.x + spins() * dirX,
        endY: landing.y + spins() * dirY,
        endZ: landing.z + spins() * dirX * dirY,
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
    const ease = 1 - Math.pow(1 - t, 3);

    groupRef.current.rotation.x = a.startX + (a.endX - a.startX) * ease;
    groupRef.current.rotation.y = a.startY + (a.endY - a.startY) * ease;
    groupRef.current.rotation.z = a.startZ + (a.endZ - a.startZ) * ease;

    // Bounce
    const bounceT = t < 0.3
      ? Math.sin(t / 0.3 * Math.PI) * 0.6
      : t < 0.55
        ? Math.sin((t - 0.3) / 0.25 * Math.PI) * 0.2
        : t < 0.75
          ? Math.sin((t - 0.55) / 0.2 * Math.PI) * 0.06
          : 0;
    groupRef.current.position.y = bounceT;

    if (t >= 1 && !a.settled) {
      a.settled = true;
      a.active = false;
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
    <div style={{ width: '100%', height: 200, cursor: 'pointer', borderRadius: 16, overflow: 'hidden' }}>
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
