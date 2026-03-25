'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

/**
 * 3D D20 icosahedron that tumbles and lands showing a number 1-20.
 * Numbers are rendered on each face of the die.
 */

// ─── Compute face centers and normals ────────────────────────

interface FaceInfo {
  center: THREE.Vector3;
  normal: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

function computeFaces(): FaceInfo[] {
  const geo = new THREE.IcosahedronGeometry(0.85, 0);
  const pos = geo.attributes.position;
  const faces: FaceInfo[] = [];

  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

    const center = new THREE.Vector3().addVectors(a, b).add(c).divideScalar(3);
    const normal = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3().subVectors(b, a),
        new THREE.Vector3().subVectors(c, a),
      )
      .normalize();

    // Quaternion to orient text to face outward
    const quaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 0, 1);
    quaternion.setFromUnitVectors(up, normal);

    faces.push({ center, normal, quaternion });
  }

  geo.dispose();
  return faces;
}

// ─── Landing rotations ──────────────────────────────────────

function generateLandingRotations(): Array<[number, number, number]> {
  const rotations: Array<[number, number, number]> = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 20; i++) {
    const y = 1 - (i / 19) * 2;
    const theta = goldenAngle * i;
    const rx = Math.acos(y);
    const ry = theta;
    const rz = (i * 0.7) % (Math.PI * 2);
    rotations.push([rx, ry, rz]);
  }
  return rotations;
}

const LAND_ROTATIONS = generateLandingRotations();

// ─── Face number labels ──────────────────────────────────────

function FaceNumbers({ faces }: { faces: FaceInfo[] }) {
  return (
    <>
      {faces.map((face, i) => {
        // Position text slightly above face surface
        const offset = face.normal.clone().multiplyScalar(0.01);
        const pos = face.center.clone().add(offset);

        return (
          <Text
            key={i}
            position={[pos.x, pos.y, pos.z]}
            quaternion={face.quaternion}
            fontSize={0.18}
            fontWeight={700}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.008}
            outlineColor="#3A2DB0"
          >
            {i + 1}
          </Text>
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
  const faces = useMemo(() => computeFaces(), []);

  const anim = useRef({
    active: false,
    startTime: 0,
    duration: 2.0,
    startX: 0, startY: 0, startZ: 0,
    endX: 0, endY: 0, endZ: 0,
    settled: false,
    targetValue: 1,
  });

  // Start animation when rolling
  const lastRolling = useRef(false);
  useEffect(() => {
    if (rolling && !lastRolling.current) {
      const value = Math.floor(Math.random() * 20) + 1;
      const [ex, ey, ez] = LAND_ROTATIONS[value - 1];

      const group = groupRef.current;
      const sx = group ? group.rotation.x : 0;
      const sy = group ? group.rotation.y : 0;
      const sz = group ? group.rotation.z : 0;

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
      <FaceNumbers faces={faces} />
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

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.86, 0]} receiveShadow>
          <planeGeometry args={[6, 6]} />
          <shadowMaterial opacity={0.12} />
        </mesh>
      </Canvas>
    </div>
  );
}
