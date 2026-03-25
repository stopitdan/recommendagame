'use client';

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 3D D20 with canvas-baked number textures and guaranteed flat landing.
 *
 * Uses quaternion SLERP for the final landing — not Euler angles —
 * so the die always settles perfectly flat on a triangular face
 * with the correct number pointing straight up.
 *
 * Two-phase animation:
 *   Phase 1 (0–70%): Chaotic tumble with consistent momentum
 *   Phase 2 (70–100%): Smooth SLERP to the exact landing quaternion
 */

// ─── Compute face data from icosahedron geometry ─────────────

interface FaceData {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  /** Quaternion that rotates this face's normal to point straight up (+Y) */
  landingQuat: THREE.Quaternion;
}

function computeFaceData(): FaceData[] {
  const geo = new THREE.IcosahedronGeometry(0.85, 0);
  const pos = geo.attributes.position;
  const faces: FaceData[] = [];

  // Camera is at [0, 2.5, 3] — land the rolled face pointing toward the viewer
  const toCamera = new THREE.Vector3(0, 2.5, 3).normalize();

  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

    const center = a.clone().add(b).add(c).divideScalar(3);

    const normal = new THREE.Vector3()
      .crossVectors(b.clone().sub(a), c.clone().sub(a))
      .normalize();

    // Land so this face's normal points toward the camera (facing the user)
    const landingQuat = new THREE.Quaternion().setFromUnitVectors(normal, toCamera);

    faces.push({ center, normal, landingQuat });
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

  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
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

interface AnimState {
  active: boolean;
  startTime: number;
  duration: number;
  /** Consistent tumble velocity — one direction, never changes */
  velX: number;
  velY: number;
  velZ: number;
  /** Landing quaternion (face toward camera) */
  landingQuat: THREE.Quaternion;
  /** Quaternion captured late in the tumble for final correction */
  lateQuat: THREE.Quaternion;
  lateCaptured: boolean;
  settled: boolean;
  targetValue: number;
}

function AnimatedD20({
  rolling,
  onSettled,
}: {
  rolling: boolean;
  onSettled: (value: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const faces = useMemo(() => computeFaceData(), []);

  const anim = useRef<AnimState>({
    active: false,
    startTime: 0,
    duration: 2.2,
    velX: 0, velY: 0, velZ: 0,
    landingQuat: new THREE.Quaternion(),
    lateQuat: new THREE.Quaternion(),
    lateCaptured: false,
    settled: false,
    targetValue: 1,
  });

  const lastRolling = useRef(false);
  const tempQuat = useRef(new THREE.Quaternion());

  useEffect(() => {
    if (rolling && !lastRolling.current) {
      const value = Math.floor(Math.random() * 20) + 1;

      // One consistent spin direction for the entire roll.
      // Primary axis gets most energy, secondary gets less, tertiary least.
      // This mimics a real die with one dominant rotation axis.
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;

      anim.current = {
        active: true,
        startTime: 0,
        duration: 1.8 + Math.random() * 0.4,
        velX: dirX * (8 + Math.random() * 4),     // Primary: 8-12 rad/s
        velY: dirY * (6 + Math.random() * 3),     // Secondary: 6-9 rad/s
        velZ: dirX * dirY * (2 + Math.random() * 2), // Tertiary: 2-4 rad/s
        landingQuat: faces[value - 1].landingQuat.clone(),
        lateQuat: new THREE.Quaternion(),
        lateCaptured: false,
        settled: false,
        targetValue: value,
      };
    }
    lastRolling.current = rolling;
  }, [rolling, faces]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a.active || !groupRef.current) return;

    if (a.startTime === 0) a.startTime = performance.now();

    const elapsed = (performance.now() - a.startTime) / 1000;
    const t = Math.min(elapsed / a.duration, 1);

    // Late transition: at 88% the die is barely spinning,
    // so the SLERP correction is tiny and invisible.
    const SNAP_START = 0.88;

    if (t < SNAP_START) {
      // ── Euler tumble: starts at full speed, decelerates like friction ──
      const phase = t / SNAP_START; // 0→1 over tumble phase
      const decel = (1 - phase) * (1 - phase); // Quadratic: fast→slow

      groupRef.current.rotation.x += a.velX * decel * delta;
      groupRef.current.rotation.y += a.velY * decel * delta;
      groupRef.current.rotation.z += a.velZ * decel * delta;
    } else {
      // ── Final 12%: tiny SLERP to exact landing ──
      if (!a.lateCaptured) {
        a.lateCaptured = true;
        a.lateQuat.copy(groupRef.current.quaternion);
      }

      const snapT = (t - SNAP_START) / (1 - SNAP_START);
      // Quadratic ease-out for gentle final settle
      const ease = 1 - (1 - snapT) * (1 - snapT);

      tempQuat.current.slerpQuaternions(a.lateQuat, a.landingQuat, ease);
      groupRef.current.quaternion.copy(tempQuat.current);
    }

    // ── Bounce ──
    let bounceY = 0;
    if (t < 0.22) {
      bounceY = Math.sin((t / 0.22) * Math.PI) * 0.5;
    } else if (t < 0.42) {
      bounceY = Math.sin(((t - 0.22) / 0.2) * Math.PI) * 0.15;
    } else if (t < 0.55) {
      bounceY = Math.sin(((t - 0.42) / 0.13) * Math.PI) * 0.04;
    }
    groupRef.current.position.y = bounceY;

    // ── Settle ──
    if (t >= 1 && !a.settled) {
      a.settled = true;
      a.active = false;
      groupRef.current.quaternion.copy(a.landingQuat);
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
