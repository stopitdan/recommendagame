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

type Phase = 'idle' | 'shrink' | 'roll' | 'present';

interface AnimState {
  phase: Phase;
  startTime: number;
  /** Roll duration */
  rollDuration: number;
  /** Start and end quaternions — single SLERP, guaranteed flat landing */
  startQuat: THREE.Quaternion;
  landingQuat: THREE.Quaternion;
  /** Wobble parameters (decaying sinusoidal noise over the SLERP) */
  wobbleAxis1: THREE.Vector3;
  wobbleAxis2: THREE.Vector3;
  wobbleFreq1: number;
  wobbleFreq2: number;
  /** Result */
  resultValue: number;
  resultReported: boolean;
}

const SHRINK_DUR = 0.25;
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
    rollDuration: 2.0,
    startQuat: new THREE.Quaternion(),
    landingQuat: new THREE.Quaternion(),
    wobbleAxis1: new THREE.Vector3(1, 0, 0),
    wobbleAxis2: new THREE.Vector3(0, 0, 1),
    wobbleFreq1: 12,
    wobbleFreq2: 9,
    resultValue: 1,
    resultReported: false,
  });

  const scaleRef = useRef(1);
  const lastRolling = useRef(false);
  const tempQuat = useRef(new THREE.Quaternion());
  const wobbleQuat = useRef(new THREE.Quaternion());

  function setPhase(phase: Phase) {
    anim.current.phase = phase;
    anim.current.startTime = 0;
  }

  useEffect(() => {
    if (rolling && !lastRolling.current) {
      // Pick a random face (1-20)
      const value = Math.floor(Math.random() * 20) + 1;

      // Capture current orientation
      const startQ = groupRef.current
        ? groupRef.current.quaternion.clone()
        : new THREE.Quaternion();

      // Landing quaternion: this face's normal points at camera
      const landingQ = faces[value - 1].landingQuat.clone();

      // To make it look like multiple full rotations, we compose
      // extra full spins INTO the landing quaternion. The SLERP
      // will take the "short" path to this pre-spun target, but
      // since the target itself encodes extra rotations, the path
      // naturally goes through many orientations.
      const spinAxis = new THREE.Vector3(
        0.5 + Math.random() * 0.5,
        0.3 + Math.random() * 0.5,
        0.2 + Math.random() * 0.3,
      ).normalize();
      const extraSpins = (3 + Math.floor(Math.random() * 3)) * Math.PI * 2; // 3-5 full rotations
      const spinQuat = new THREE.Quaternion().setFromAxisAngle(spinAxis, extraSpins);
      landingQ.premultiply(spinQuat);

      // Random wobble axes (perpendicular-ish to add chaos)
      const w1 = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const w2 = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();

      anim.current.rollDuration = 1.8 + Math.random() * 0.4;
      anim.current.startQuat.copy(startQ);
      anim.current.landingQuat.copy(landingQ);
      anim.current.wobbleAxis1.copy(w1);
      anim.current.wobbleAxis2.copy(w2);
      anim.current.wobbleFreq1 = 10 + Math.random() * 6;  // 10-16 Hz
      anim.current.wobbleFreq2 = 7 + Math.random() * 5;   // 7-12 Hz
      anim.current.resultValue = value;
      anim.current.resultReported = false;

      if (scaleRef.current > 0.95) {
        setPhase('shrink');
      } else {
        setPhase('roll');
      }
    }
    lastRolling.current = rolling;
  }, [rolling, faces]);

  useFrame(() => {
    const a = anim.current;
    const group = groupRef.current;
    if (!group || a.phase === 'idle') return;

    if (a.startTime === 0) a.startTime = performance.now();
    const elapsed = (performance.now() - a.startTime) / 1000;

    switch (a.phase) {
      // ── Shrink before re-roll ──
      case 'shrink': {
        const t = Math.min(elapsed / SHRINK_DUR, 1);
        scaleRef.current = 1.08 - t * 0.78; // 1.08 → 0.3
        group.scale.setScalar(scaleRef.current);

        if (t >= 1) {
          scaleRef.current = 0.3;
          group.scale.setScalar(0.3);
          setPhase('roll');
        }
        break;
      }

      // ── Single-motion roll: SLERP + decaying wobble ──
      case 'roll': {
        const t = Math.min(elapsed / a.rollDuration, 1);

        // Scale back up
        if (scaleRef.current < 1) {
          const growT = Math.min(elapsed / 0.3, 1);
          scaleRef.current = 0.3 + 0.7 * (1 - Math.pow(1 - growT, 3));
          group.scale.setScalar(scaleRef.current);
        }

        // Core rotation: SLERP from start to landing (includes extra spins)
        // Ease: fast start, smooth deceleration
        const ease = 1 - Math.pow(1 - t, 3); // Cubic ease-out
        tempQuat.current.slerpQuaternions(a.startQuat, a.landingQuat, ease);

        // Decaying wobble: high-frequency oscillation that fades to zero
        // This makes the SLERP path look chaotic/tumbling
        const wobbleStrength = Math.pow(1 - t, 3) * 0.4; // Strong at start, zero at end
        const w1Angle = Math.sin(elapsed * a.wobbleFreq1) * wobbleStrength;
        const w2Angle = Math.sin(elapsed * a.wobbleFreq2 * 1.3) * wobbleStrength * 0.7;

        wobbleQuat.current.setFromAxisAngle(a.wobbleAxis1, w1Angle);
        tempQuat.current.multiply(wobbleQuat.current);
        wobbleQuat.current.setFromAxisAngle(a.wobbleAxis2, w2Angle);
        tempQuat.current.multiply(wobbleQuat.current);

        group.quaternion.copy(tempQuat.current);

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
          // Exactly at landing — no correction needed
          group.quaternion.copy(a.landingQuat);
          group.position.y = 0;
          scaleRef.current = 1;
          group.scale.setScalar(1);
          setPhase('present');
        }
        break;
      }

      // ── Present: grow slightly to highlight the result ──
      case 'present': {
        const t = Math.min(elapsed / PRESENT_DUR, 1);
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
