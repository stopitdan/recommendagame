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

type Phase = 'idle' | 'shrink' | 'tumble' | 'settle' | 'present';

interface AnimState {
  phase: Phase;
  startTime: number;
  /** Tumble config */
  tumbleDuration: number;
  velX: number;
  velY: number;
  velZ: number;
  /** Settle config (smooth SLERP to nearest face) */
  settleStartQuat: THREE.Quaternion;
  settleTargetQuat: THREE.Quaternion;
  /** Result */
  resultValue: number;
  resultReported: boolean;
}

/** Duration of each non-tumble phase */
const SHRINK_DUR = 0.25;
const SETTLE_DUR = 0.5;
const PRESENT_DUR = 0.35;

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
    phase: 'idle',
    startTime: 0,
    tumbleDuration: 2.0,
    velX: 0, velY: 0, velZ: 0,
    settleStartQuat: new THREE.Quaternion(),
    settleTargetQuat: new THREE.Quaternion(),
    resultValue: 1,
    resultReported: false,
  });

  const scaleRef = useRef(1);
  const lastRolling = useRef(false);
  const toCamera = useMemo(() => new THREE.Vector3(0, 2.5, 3).normalize(), []);

  /** Find nearest face to camera and compute the correction quaternion */
  function computeNearestFaceLanding(): { value: number; targetQuat: THREE.Quaternion } {
    const group = groupRef.current!;
    const worldNormal = new THREE.Vector3();
    let bestDot = -Infinity;
    let bestIdx = 0;

    for (let i = 0; i < faces.length; i++) {
      worldNormal.copy(faces[i].normal).applyQuaternion(group.quaternion);
      const dot = worldNormal.dot(toCamera);
      if (dot > bestDot) {
        bestDot = dot;
        bestIdx = i;
      }
    }

    // Compute target: current quat corrected so best face points at camera
    worldNormal.copy(faces[bestIdx].normal).applyQuaternion(group.quaternion);
    const correction = new THREE.Quaternion().setFromUnitVectors(worldNormal, toCamera);
    const targetQuat = group.quaternion.clone().premultiply(correction);

    return { value: bestIdx + 1, targetQuat };
  }

  // Transition to a new phase
  function setPhase(phase: Phase) {
    anim.current.phase = phase;
    anim.current.startTime = 0; // Will be set on next frame
  }

  useEffect(() => {
    if (rolling && !lastRolling.current) {
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;

      anim.current.tumbleDuration = 1.8 + Math.random() * 0.4;
      anim.current.velX = dirX * (8 + Math.random() * 4);
      anim.current.velY = dirY * (6 + Math.random() * 3);
      anim.current.velZ = dirX * dirY * (2 + Math.random() * 2);
      anim.current.resultReported = false;

      // If already presented (re-roll), shrink first. Otherwise go straight to tumble.
      if (scaleRef.current > 0.95) {
        setPhase('shrink');
      } else {
        setPhase('tumble');
      }
    }
    lastRolling.current = rolling;
  }, [rolling]);

  useFrame((_, delta) => {
    const a = anim.current;
    const group = groupRef.current;
    if (!group || a.phase === 'idle') return;

    // Lazy init startTime
    if (a.startTime === 0) a.startTime = performance.now();
    const elapsed = (performance.now() - a.startTime) / 1000;

    switch (a.phase) {
      // ── Shrink before re-roll ──
      case 'shrink': {
        const t = Math.min(elapsed / SHRINK_DUR, 1);
        const ease = t * t; // Ease-in (accelerate into shrink)
        scaleRef.current = 1 - ease * 0.7; // Shrink to 0.3
        group.scale.setScalar(scaleRef.current);

        if (t >= 1) {
          scaleRef.current = 0.3;
          group.scale.setScalar(0.3);
          setPhase('tumble');
        }
        break;
      }

      // ── Main tumble: pure physics ──
      case 'tumble': {
        const t = Math.min(elapsed / a.tumbleDuration, 1);

        // Scale back up at the start of tumble
        if (scaleRef.current < 1) {
          const growT = Math.min(elapsed / 0.3, 1); // 0.3s to grow back
          const growEase = 1 - Math.pow(1 - growT, 3);
          scaleRef.current = 0.3 + 0.7 * growEase;
          group.scale.setScalar(scaleRef.current);
        }

        // Euler tumble with quadratic deceleration
        const decel = (1 - t) * (1 - t);
        group.rotation.x += a.velX * decel * delta;
        group.rotation.y += a.velY * decel * delta;
        group.rotation.z += a.velZ * decel * delta;

        // Bounce
        let bounceY = 0;
        if (t < 0.22) {
          bounceY = Math.sin((t / 0.22) * Math.PI) * 0.5;
        } else if (t < 0.42) {
          bounceY = Math.sin(((t - 0.22) / 0.2) * Math.PI) * 0.15;
        } else if (t < 0.55) {
          bounceY = Math.sin(((t - 0.42) / 0.13) * Math.PI) * 0.04;
        }
        group.position.y = bounceY;

        if (t >= 1) {
          group.position.y = 0;
          // Compute where to settle
          const { value, targetQuat } = computeNearestFaceLanding();
          a.settleStartQuat.copy(group.quaternion);
          a.settleTargetQuat.copy(targetQuat);
          a.resultValue = value;
          setPhase('settle');
        }
        break;
      }

      // ── Smooth settle to flat face (small rotation) ──
      case 'settle': {
        const t = Math.min(elapsed / SETTLE_DUR, 1);
        // Cubic ease-out for gentle deceleration into flat
        const ease = 1 - Math.pow(1 - t, 3);

        group.quaternion.slerpQuaternions(a.settleStartQuat, a.settleTargetQuat, ease);

        if (t >= 1) {
          group.quaternion.copy(a.settleTargetQuat);
          setPhase('present');
        }
        break;
      }

      // ── Present: grow slightly to highlight the result ──
      case 'present': {
        const t = Math.min(elapsed / PRESENT_DUR, 1);
        // Spring-like overshoot: grows to 1.12 then settles to 1.08
        const spring = 1 + 0.08 * (1 - Math.pow(1 - t, 3)) + 0.04 * Math.sin(t * Math.PI);
        scaleRef.current = spring;
        group.scale.setScalar(spring);

        if (t >= 1) {
          scaleRef.current = 1.08;
          group.scale.setScalar(1.08);
          a.phase = 'idle';

          if (!a.resultReported) {
            a.resultReported = true;
            onSettled(a.resultValue);
          }
        }
        break;
      }
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
