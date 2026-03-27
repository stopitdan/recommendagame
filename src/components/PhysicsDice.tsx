'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type DiceSkin, type DiceSkinType, getSkin, getEmojiForFace, DEFAULT_SKIN_ID } from '@/lib/dice-skins';
import { getShaderCode, SHADER_DEFAULTS } from '@/lib/dice-shaders';
import type { CustomDiceSkinConfig } from '@/types/custom-dice';

/**
 * 3D D20 with physically correct rigid body rotation.
 *
 * Supports three material modes:
 * - solid: MeshStandardMaterial with a flat color
 * - shader: Custom GLSL ShaderMaterial with time-based animation
 * - emoji: MeshStandardMaterial + emoji face labels instead of numbers
 *
 * Physics: A regular icosahedron is a "spherical top" — all three
 * principal moments of inertia are equal (I1 = I2 = I3). For a
 * torque-free spherical top, angular velocity omega is CONSTANT
 * in the world frame (conservation of angular momentum).
 *
 * Integration: q(t+dt) = deltaQ * q(t)
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

// Pre-compute the quaternion that makes face 20 point at the camera
const INITIAL_QUAT = new THREE.Quaternion().setFromUnitVectors(
  globalFaces[19].normal, // face 20 is index 19
  new THREE.Vector3(0, -0.2, 7).normalize(),
);

// ─── Create number texture via canvas ────────────────────────

function createNumberTexture(
  num: number,
  color = '#FFFFFF',
  shadowColor = 'rgba(0,0,0,0.5)',
  sizeMultiplier = 1.0,
  fontFamily = 'Arial',
  fontWeight = 'bold',
): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const basePx = num > 9 ? 48 : 56;
  const px = Math.round(basePx * sizeMultiplier);

  ctx.clearRect(0, 0, size, size);
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 4;
  ctx.fillStyle = color;
  ctx.font = `${fontWeight} ${px}px ${fontFamily}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ─── Create emoji texture via canvas ─────────────────────────

function createEmojiTexture(num: number, skinId: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  // Emoji expression based on face value
  const emoji = getEmojiForFace(num, skinId);
  ctx.font = '52px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 - 8);

  // Small number below
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText(String(num), size / 2, size - 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ─── Face labels on the die ──────────────────────────────────

function FaceLabels({ faces, skin, labelStyle, labelSize, labelFont, labelWeight }: {
  faces: FaceData[];
  skin: DiceSkin;
  /** Override label style — used by custom dice for 'hidden' mode */
  labelStyle?: 'numbers' | 'emoji' | 'hidden';
  labelSize?: number;
  labelFont?: string;
  labelWeight?: string;
}) {
  const effectiveStyle = labelStyle ?? (skin.type === 'emoji' ? 'emoji' : 'numbers');

  const textures = useMemo(() => {
    if (effectiveStyle === 'hidden') return null;
    if (effectiveStyle === 'emoji') {
      return Array.from({ length: 20 }, (_, i) => createEmojiTexture(i + 1, skin.id));
    }
    return Array.from({ length: 20 }, (_, i) =>
      createNumberTexture(i + 1, skin.label, skin.labelShadow, labelSize, labelFont, labelWeight),
    );
  }, [effectiveStyle, skin.id, skin.label, skin.labelShadow, labelSize, labelFont, labelWeight]);

  if (!textures) return null;

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

// ─── Shader material for animated skins ──────────────────────

function ShaderDiceMaterial({ shaderKey, shaderColors, speed = 1.0 }: {
  shaderKey: string;
  /** Optional custom colors — falls back to SHADER_DEFAULTS for this key */
  shaderColors?: { color1: string; color2: string; color3: string };
  /** Animation speed multiplier (default 1.0) */
  speed?: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  // Resolve colors: custom → defaults → white fallback
  const defaults = SHADER_DEFAULTS[shaderKey];
  const c1 = shaderColors?.color1 ?? defaults?.color1 ?? '#FFFFFF';
  const c2 = shaderColors?.color2 ?? defaults?.color2 ?? '#FFFFFF';
  const c3 = shaderColors?.color3 ?? defaults?.color3 ?? '#FFFFFF';

  // Only recreate the material when the shader KEY changes (different GLSL program)
  const material = useMemo(() => {
    const code = getShaderCode(shaderKey);
    if (!code) return null;
    return new THREE.ShaderMaterial({
      vertexShader: code.vertex,
      fragmentShader: code.fragment,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(c1) },
        uColor2: { value: new THREE.Color(c2) },
        uColor3: { value: new THREE.Color(c3) },
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderKey]);

  // Update color uniforms and advance time at custom speed
  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta * speed;
      matRef.current.uniforms.uColor1.value.set(c1);
      matRef.current.uniforms.uColor2.value.set(c2);
      matRef.current.uniforms.uColor3.value.set(c3);
    }
  });

  if (!material) return null;
  return <primitive ref={matRef} object={material} attach="material" />;
}

// ─── Image-based material ─────────────────────────────────────

function ImageDiceMaterial({ url, bodyColor, metalness, roughness }: {
  url: string;
  bodyColor: string;
  metalness: number;
  roughness: number;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) return;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        tex.needsUpdate = true;
        setTexture(tex);
      },
      undefined,
      () => {
        // Load failed — fall back to body color (texture stays null)
      },
    );
    return () => {
      texture?.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <meshStandardMaterial
      map={texture ?? undefined}
      color={texture ? '#ffffff' : bodyColor}
      metalness={metalness}
      roughness={roughness}
      flatShading
    />
  );
}

// ─── Overlay shader mesh (transparent layer on top of base) ───

function OverlayMesh({ shaderKey, opacity }: {
  shaderKey: string;
  opacity: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const defaults = SHADER_DEFAULTS[shaderKey];

  const material = useMemo(() => {
    const code = getShaderCode(shaderKey);
    if (!code) return null;

    // Inject uOpacity uniform into the fragment shader and multiply alpha by it
    const overlayFragment = code.fragment.replace(
      'uniform float uTime;',
      'uniform float uTime;\nuniform float uOpacity;',
    ).replace(
      /gl_FragColor\s*=\s*vec4\(([^,]+),\s*1\.0\)\s*;/,
      'gl_FragColor = vec4($1, uOpacity);',
    );

    return new THREE.ShaderMaterial({
      vertexShader: code.vertex,
      fragmentShader: overlayFragment,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uColor1: { value: new THREE.Color(defaults?.color1 ?? '#FFFFFF') },
        uColor2: { value: new THREE.Color(defaults?.color2 ?? '#FFFFFF') },
        uColor3: { value: new THREE.Color(defaults?.color3 ?? '#FFFFFF') },
      },
      transparent: true,
      depthWrite: false,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderKey]);

  // Update opacity reactively without recreating the material
  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
      matRef.current.uniforms.uOpacity.value = opacity;
    }
  });

  if (!material) return null;

  return (
    <mesh>
      <icosahedronGeometry args={[0.851, 0]} />
      <primitive ref={matRef} object={material} attach="material" />
    </mesh>
  );
}

// ─── Animated D20 with rigid body physics ────────────────────

type Phase = 'idle' | 'shrink' | 'flight' | 'decel' | 'settle' | 'present';

const SHRINK_DUR = 0.25;
const FLIGHT_DUR = 1.3;   // Free flight at constant omega
const DECEL_DUR = 0.8;    // Friction slowing it down
const SETTLE_DUR = 0.3;   // Final tiny SLERP to flat face
const PRESENT_DUR = 0.35; // Grow to highlight result

/** Camera direction — the face we want pointing at the user */
const TO_CAMERA = new THREE.Vector3(0, -0.2, 7).normalize();

function AnimatedD20({
  rolling,
  onSettled,
  skin,
  isNat20,
}: {
  rolling: boolean;
  onSettled: (value: number) => void;
  skin: DiceSkin;
  isNat20?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Set initial orientation to show face 20 on mount
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.quaternion.copy(INITIAL_QUAT);
    }
  }, []);

  const state = useRef({
    phase: 'idle' as Phase,
    phaseStart: 0,
    omega: new THREE.Vector3(),
    speed: 0,
    axis: new THREE.Vector3(0, 1, 0),
    precessionAxis: new THREE.Vector3(1, 0, 0),
    precessionRate: 0,
    deltaQ: new THREE.Quaternion(),
    settleFrom: new THREE.Quaternion(),
    settleTo: new THREE.Quaternion(),
    resultValue: 1,
    resultReported: false,
  });

  const scaleRef = useRef(1);
  const lastRolling = useRef(false);

  function setPhase(phase: Phase) {
    state.current.phase = phase;
    state.current.phaseStart = 0;
  }

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
      const omega = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize().multiplyScalar(15 + Math.random() * 10);

      state.current.omega.copy(omega);
      state.current.speed = omega.length();
      state.current.axis.copy(omega).normalize();

      const precAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize();
      precAxis.addScaledVector(state.current.axis, -precAxis.dot(state.current.axis));
      precAxis.normalize();

      state.current.precessionAxis.copy(precAxis);
      state.current.precessionRate = 1.5 + Math.random() * 1.0;
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

      case 'flight': {
        const t = Math.min(elapsed / FLIGHT_DUR, 1);

        if (scaleRef.current < 1) {
          const growT = Math.min(elapsed / 0.3, 1);
          scaleRef.current = 0.3 + 0.7 * (1 - Math.pow(1 - growT, 3));
          group.scale.setScalar(scaleRef.current);
        }

        const precAngle = s.precessionRate * dt;
        const precQ = new THREE.Quaternion().setFromAxisAngle(s.precessionAxis, precAngle);
        s.axis.applyQuaternion(precQ).normalize();

        const theta = s.speed * dt;
        s.deltaQ.setFromAxisAngle(s.axis, theta);
        group.quaternion.premultiply(s.deltaQ);
        group.quaternion.normalize();

        const bounces = [
          { dur: 0.40, h: 1.1 },
          { dur: 0.30, h: 0.55 },
          { dur: 0.20, h: 0.24 },
          { dur: 0.12, h: 0.10 },
          { dur: 0.07, h: 0.03 },
        ];
        let bounceY = 0;
        let bt = t;
        for (const b of bounces) {
          if (bt < b.dur) {
            const x = bt / b.dur;
            bounceY = 4 * b.h * x * (1 - x);
            break;
          }
          bt -= b.dur;
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

      case 'decel': {
        const t = Math.min(elapsed / DECEL_DUR, 1);
        const decayedSpeed = s.speed * Math.exp(-3.0 * t);

        const precAngle = s.precessionRate * Math.exp(-2.0 * t) * dt;
        const precQ = new THREE.Quaternion().setFromAxisAngle(s.precessionAxis, precAngle);
        s.axis.applyQuaternion(precQ).normalize();

        const theta = decayedSpeed * dt;
        s.deltaQ.setFromAxisAngle(s.axis, theta);
        group.quaternion.premultiply(s.deltaQ);
        group.quaternion.normalize();

        if (t >= 1) {
          const { value, quat } = computeLanding(group);
          s.settleFrom.copy(group.quaternion);
          s.settleTo.copy(quat);
          s.resultValue = value;
          setPhase('settle');
        }
        break;
      }

      case 'settle': {
        const t = Math.min(elapsed / SETTLE_DUR, 1);
        const ease = t * (2 - t);
        group.quaternion.slerpQuaternions(s.settleFrom, s.settleTo, ease);

        if (t >= 1) {
          group.quaternion.copy(s.settleTo);
          setPhase('present');
        }
        break;
      }

      case 'present': {
        const t = Math.min(elapsed / PRESENT_DUR, 1);
        const presentMax = isNat20 ? 0.12 : 0.08;
        const presentBounce = isNat20 ? 0.06 : 0.04;
        const spring = 1 + presentMax * (1 - Math.pow(1 - t, 3)) + presentBounce * Math.sin(t * Math.PI);
        scaleRef.current = spring;
        group.scale.setScalar(spring);

        if (t >= 1) {
          const finalScale = isNat20 ? 1.12 : 1.08;
          scaleRef.current = finalScale;
          group.scale.setScalar(finalScale);
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

  const isShader = skin.type === 'shader' && skin.shaderKey;

  // Extract custom config if present (from resolveCustomSkin)
  const customConfig = (skin as DiceSkin & { customConfig?: CustomDiceSkinConfig }).customConfig;
  const labelStyle = customConfig?.labelStyle;
  const isImage = customConfig?.baseType === 'image' && !!customConfig?.wrapImageUrl;

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <icosahedronGeometry args={[0.85, 0]} />
        {isShader ? (
          <ShaderDiceMaterial
            shaderKey={skin.shaderKey!}
            shaderColors={customConfig?.shaderColors}
            speed={customConfig?.shaderSpeed}
          />
        ) : isImage ? (
          <ImageDiceMaterial
            url={customConfig!.wrapImageUrl!}
            bodyColor={skin.body}
            metalness={skin.metalness}
            roughness={skin.roughness}
          />
        ) : (
          <meshStandardMaterial
            color={skin.body}
            metalness={skin.metalness}
            roughness={skin.roughness}
            flatShading
          />
        )}
      </mesh>
      {customConfig?.overlayShaderKey && (
        <OverlayMesh
          shaderKey={customConfig.overlayShaderKey}
          opacity={customConfig.overlayOpacity ?? 0.5}
        />
      )}
      <FaceLabels
        faces={globalFaces}
        skin={skin}
        labelStyle={labelStyle}
        labelSize={customConfig?.labelSize}
        labelFont={customConfig?.labelFont}
        labelWeight={customConfig?.labelWeight}
      />
    </group>
  );
}

// ─── Main Component ──────────────────────────────────────────

// ─── Pulsing gold light for Nat 20 ──────────────────────────

function Nat20PulsingLight() {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (lightRef.current) {
      lightRef.current.intensity = 0.6 + Math.sin(clock.elapsedTime * 3) * 0.4;
    }
  });

  return (
    <pointLight ref={lightRef} position={[0, 2, 2]} color="#FFD700" intensity={0.6} distance={10} />
  );
}

// ─── Main Component ──────────────────────────────────────────

interface PhysicsDiceProps {
  rolling: boolean;
  onSettled: (value: number) => void;
  /** Full skin object — controls colors, material, and label style */
  skin?: DiceSkin;
  /** When true, adds pulsing gold light and larger present scale */
  isNat20?: boolean;
}

export default function PhysicsDice({ rolling, onSettled, skin, isNat20 }: PhysicsDiceProps) {
  const activeSkin = skin ?? getSkin(DEFAULT_SKIN_ID);

  return (
    <div style={{ width: '100%', height: 300, cursor: 'pointer', borderRadius: 16, overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, -0.2, 7], fov: 30, near: 0.1 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 3]} intensity={1.2} />
        <pointLight position={[-2, 3, -1]} intensity={0.3} color={activeSkin.accent} />
        {isNat20 && <Nat20PulsingLight />}
        <AnimatedD20 rolling={rolling} onSettled={onSettled} skin={activeSkin} isNat20={isNat20} />
      </Canvas>
    </div>
  );
}
