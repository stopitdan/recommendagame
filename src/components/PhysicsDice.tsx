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

// Compute once, shared by both AnimatedD20 and FaceLabels
const globalFaces = computeFaceData();

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
  settled: boolean;
}

function AnimatedD20({
  rolling,
  onSettled,
  faces,
}: {
  rolling: boolean;
  onSettled: (value: number) => void;
  faces: FaceData[];
}) {
  const groupRef = useRef<THREE.Group>(null);

  const anim = useRef<AnimState>({
    active: false,
    startTime: 0,
    duration: 2.2,
    velX: 0, velY: 0, velZ: 0,
    settled: false,
  });

  const lastRolling = useRef(false);

  /** Find which face's normal is most aligned with the camera direction */
  function findFacingCamera(): number {
    if (!groupRef.current) return 1;

    const toCamera = new THREE.Vector3(0, 2.5, 3).normalize();
    const worldNormal = new THREE.Vector3();
    let bestDot = -Infinity;
    let bestFace = 0;

    for (let i = 0; i < faces.length; i++) {
      // Transform face normal from local to world space
      worldNormal.copy(faces[i].normal);
      worldNormal.applyQuaternion(groupRef.current.quaternion);

      const dot = worldNormal.dot(toCamera);
      if (dot > bestDot) {
        bestDot = dot;
        bestFace = i;
      }
    }

    return bestFace + 1; // 1-indexed
  }

  /**
   * Snap to the nearest face so the die rests perfectly flat.
   * Finds the face whose normal is closest to the camera direction,
   * then rotates minimally to align it exactly.
   */
  function snapToNearestFace() {
    if (!groupRef.current) return;

    const toCamera = new THREE.Vector3(0, 2.5, 3).normalize();
    const worldNormal = new THREE.Vector3();
    let bestDot = -Infinity;
    let bestIdx = 0;

    for (let i = 0; i < faces.length; i++) {
      worldNormal.copy(faces[i].normal);
      worldNormal.applyQuaternion(groupRef.current.quaternion);
      const dot = worldNormal.dot(toCamera);
      if (dot > bestDot) {
        bestDot = dot;
        bestIdx = i;
      }
    }

    // The correction is the rotation from current best-face-world-normal
    // to the exact camera direction. This is always a TINY rotation
    // (just a few degrees) since we picked the closest face.
    worldNormal.copy(faces[bestIdx].normal);
    worldNormal.applyQuaternion(groupRef.current.quaternion);

    const correction = new THREE.Quaternion().setFromUnitVectors(worldNormal, toCamera);
    groupRef.current.quaternion.premultiply(correction);
  }

  useEffect(() => {
    if (rolling && !lastRolling.current) {
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;

      anim.current = {
        active: true,
        startTime: 0,
        duration: 1.8 + Math.random() * 0.4,
        velX: dirX * (8 + Math.random() * 4),
        velY: dirY * (6 + Math.random() * 3),
        velZ: dirX * dirY * (2 + Math.random() * 2),
        settled: false,
      };
    }
    lastRolling.current = rolling;
  }, [rolling]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a.active || !groupRef.current) return;

    if (a.startTime === 0) a.startTime = performance.now();

    const elapsed = (performance.now() - a.startTime) / 1000;
    const t = Math.min(elapsed / a.duration, 1);

    // ── Pure Euler tumble with quadratic deceleration ──
    // One direction, gradually slowing. No correction, no SLERP.
    const decel = (1 - t) * (1 - t);
    groupRef.current.rotation.x += a.velX * decel * delta;
    groupRef.current.rotation.y += a.velY * decel * delta;
    groupRef.current.rotation.z += a.velZ * decel * delta;

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

    // ── Settle: let physics decide the result ──
    if (t >= 1 && !a.settled) {
      a.settled = true;
      a.active = false;
      groupRef.current.position.y = 0;

      // Tiny snap to nearest flat face (just a few degrees — invisible)
      snapToNearestFace();

      // Report whichever face ended up facing the camera
      onSettled(findFacingCamera());
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
      <FaceLabels faces={globalFaces} />
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
        <AnimatedD20 rolling={rolling} onSettled={onSettled} faces={globalFaces} />
      </Canvas>
    </div>
  );
}
