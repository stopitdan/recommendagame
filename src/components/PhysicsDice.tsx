'use client';

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 3D D20 with physically correct rigid body rotation.
 *
 * Physics: A regular icosahedron is a "spherical top" — all three
 * principal moments of inertia are equal (I1 = I2 = I3). For a
 * torque-free spherical top, angular velocity omega is CONSTANT
 * in the world frame (conservation of angular momentum).
 *
 * This means: every frame we apply the exact same incremental
 * rotation quaternion. No direction changes, no wobble artifacts.
 * The die spins around a fixed axis in space, which has components
 * on all 3 coordinate axes for realistic multi-axis tumble.
 *
 * Integration: q(t+dt) = deltaQ * q(t)
 * where deltaQ = Quaternion.setFromAxisAngle(omega.normalized(), |omega| * dt)
 *
 * Sources:
 * - Ashwin Narayan, "How to Integrate Quaternions"
 * - Euler's equations for torque-free rigid body dynamics
 * - Three.js Quaternion.premultiply for world-frame rotation
 */

// ─── Compute face data from icosahedron geometry ─────────────

interface FaceData {
  center: THREE.Vector3;
  normal: THREE.Vector3;
}

function computeFaceData(): FaceData[] {
  const geo = new THREE.IcosahedronGeometry(0.85, 0);
  const pos = geo.attributes.position;
  const faces: FaceData[] = [];

  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

    const center = a.clone().add(b).add(c).divideScalar(3);
    const normal = new THREE.Vector3()
      .crossVectors(b.clone().sub(a), c.clone().sub(a))
      .normalize();

    faces.push({ center, normal });
  }

  geo.dispose();
  return faces;
}

// Compute once, shared by all components
const globalFaces = computeFaceData();

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

// ─── Animated D20 with rigid body physics ────────────────────

type Phase = 'idle' | 'shrink' | 'flight' | 'decel' | 'settle' | 'present';

const SHRINK_DUR = 0.25;
const FLIGHT_DUR = 0.9;   // Free flight at constant omega
const DECEL_DUR = 0.8;    // Friction slowing it down
const SETTLE_DUR = 0.3;   // Final tiny SLERP to flat face
const PRESENT_DUR = 0.35; // Grow to highlight result

/** Camera direction — the face we want pointing at the user */
const TO_CAMERA = new THREE.Vector3(0, 2.5, 3).normalize();

function AnimatedD20({
  rolling,
  onSettled,
}: {
  rolling: boolean;
  onSettled: (value: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const state = useRef({
    phase: 'idle' as Phase,
    phaseStart: 0,
    // Angular velocity vector (rad/s) — constant during flight
    omega: new THREE.Vector3(),
    // Current omega magnitude (decays during decel phase)
    speed: 0,
    // Normalized omega direction (never changes)
    axis: new THREE.Vector3(0, 1, 0),
    // Reusable quaternion for incremental rotation
    deltaQ: new THREE.Quaternion(),
    // Settle targets
    settleFrom: new THREE.Quaternion(),
    settleTo: new THREE.Quaternion(),
    // Result
    resultValue: 1,
    resultReported: false,
  });

  const scaleRef = useRef(1);
  const lastRolling = useRef(false);

  function setPhase(phase: Phase) {
    state.current.phase = phase;
    state.current.phaseStart = 0;
  }

  /** Find nearest face to camera and compute landing quaternion */
  function computeLanding(group: THREE.Group): { value: number; quat: THREE.Quaternion } {
    const worldNormal = new THREE.Vector3();
    let bestDot = -Infinity;
    let bestIdx = 0;

    for (let i = 0; i < globalFaces.length; i++) {
      worldNormal.copy(globalFaces[i].normal).applyQuaternion(group.quaternion);
      const dot = worldNormal.dot(TO_CAMERA);
      if (dot > bestDot) {
        bestDot = dot;
        bestIdx = i;
      }
    }

    worldNormal.copy(globalFaces[bestIdx].normal).applyQuaternion(group.quaternion);
    const correction = new THREE.Quaternion().setFromUnitVectors(worldNormal, TO_CAMERA);
    const landingQuat = group.quaternion.clone().premultiply(correction);

    return { value: bestIdx + 1, quat: landingQuat };
  }

  useEffect(() => {
    if (rolling && !lastRolling.current) {
      // Random angular velocity: all 3 axes for multi-axis tumble
      // Magnitude 15-25 rad/s for a satisfying spin speed
      const omega = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize().multiplyScalar(15 + Math.random() * 10);

      state.current.omega.copy(omega);
      state.current.speed = omega.length();
      state.current.axis.copy(omega).normalize();
      state.current.resultReported = false;

      if (scaleRef.current > 0.95) {
        setPhase('shrink');
      } else {
        setPhase('flight');
      }
    }
    lastRolling.current = rolling;
  }, [rolling]);

  useFrame((_, dt) => {
    const s = state.current;
    const group = groupRef.current;
    if (!group || s.phase === 'idle') return;

    if (s.phaseStart === 0) s.phaseStart = performance.now();
    const elapsed = (performance.now() - s.phaseStart) / 1000;

    switch (s.phase) {
      // ── Shrink before re-roll ──
      case 'shrink': {
        const t = Math.min(elapsed / SHRINK_DUR, 1);
        scaleRef.current = 1.08 - t * 0.78;
        group.scale.setScalar(scaleRef.current);
        if (t >= 1) {
          scaleRef.current = 0.3;
          group.scale.setScalar(0.3);
          setPhase('flight');
        }
        break;
      }

      // ── Free flight: constant angular velocity (real physics) ──
      case 'flight': {
        const t = Math.min(elapsed / FLIGHT_DUR, 1);

        // Scale back up at start
        if (scaleRef.current < 1) {
          const growT = Math.min(elapsed / 0.3, 1);
          scaleRef.current = 0.3 + 0.7 * (1 - Math.pow(1 - growT, 3));
          group.scale.setScalar(scaleRef.current);
        }

        // Integrate rotation: q(t+dt) = deltaQ * q(t)
        // deltaQ = Quaternion(axis, |omega| * dt)
        // This is exact for constant omega (spherical top)
        const theta = s.speed * dt;
        s.deltaQ.setFromAxisAngle(s.axis, theta);
        group.quaternion.premultiply(s.deltaQ);
        group.quaternion.normalize();

        // Bounce
        let bounceY = 0;
        if (t < 0.3) {
          bounceY = Math.sin((t / 0.3) * Math.PI) * 0.5;
        } else if (t < 0.55) {
          bounceY = Math.sin(((t - 0.3) / 0.25) * Math.PI) * 0.15;
        } else if (t < 0.7) {
          bounceY = Math.sin(((t - 0.55) / 0.15) * Math.PI) * 0.04;
        }
        group.position.y = bounceY;

        if (t >= 1) {
          group.position.y = 0;
          scaleRef.current = 1;
          group.scale.setScalar(1);
          setPhase('decel');
        }
        break;
      }

      // ── Deceleration: friction slowing the spin ──
      case 'decel': {
        const t = Math.min(elapsed / DECEL_DUR, 1);

        // Exponential decay of speed (same axis, just slower)
        // At t=0: full speed. At t=1: ~5% of original speed.
        const decayedSpeed = s.speed * Math.exp(-3.0 * t);

        // Same integration, just with shrinking speed
        const theta = decayedSpeed * dt;
        s.deltaQ.setFromAxisAngle(s.axis, theta);
        group.quaternion.premultiply(s.deltaQ);
        group.quaternion.normalize();

        if (t >= 1) {
          // Die is nearly stopped — find nearest face and settle
          const { value, quat } = computeLanding(group);
          s.settleFrom.copy(group.quaternion);
          s.settleTo.copy(quat);
          s.resultValue = value;
          setPhase('settle');
        }
        break;
      }

      // ── Settle: tiny SLERP to exact flat face ──
      case 'settle': {
        const t = Math.min(elapsed / SETTLE_DUR, 1);
        // Quadratic ease-out: gentle final adjustment
        const ease = t * (2 - t);
        group.quaternion.slerpQuaternions(s.settleFrom, s.settleTo, ease);

        if (t >= 1) {
          group.quaternion.copy(s.settleTo);
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
          s.phase = 'idle';

          if (!s.resultReported) {
            s.resultReported = true;
            onSettled(s.resultValue);
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
        <AnimatedD20 rolling={rolling} onSettled={onSettled} />
      </Canvas>
    </div>
  );
}
