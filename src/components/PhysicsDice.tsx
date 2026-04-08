'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type DiceSkin, getSkin, getEmojiForFace, DEFAULT_SKIN_ID } from '@/lib/dice-skins';
import { getShaderCode, SHADER_DEFAULTS } from '@/lib/dice-shaders';
import type { CustomDiceSkinConfig } from '@/types/custom-dice';
import {
  type DiceType,
  type FaceData,
  DICE_CONFIGS,
  getFaceData,
  getInitialQuat,
} from '@/lib/dice-geometries';

/**
 * 3D dice with physically correct rigid body rotation.
 *
 * Supports all D&D 5e dice types (D4, D6, D8, D10, D12, D20, D100)
 * and three material modes:
 * - solid: MeshStandardMaterial with a flat color
 * - shader: Custom GLSL ShaderMaterial with time-based animation
 * - emoji: MeshStandardMaterial + emoji face labels instead of numbers
 *
 * Physics: All convex polyhedra are approximated as spherical tops --
 * angular velocity omega is constant in the world frame (conservation
 * of angular momentum). Integration: q(t+dt) = deltaQ * q(t)
 */

/** Camera direction -- the face we want pointing at the user */
const TO_CAMERA = new THREE.Vector3(0, -0.2, 7).normalize();

// ─── Create number texture via canvas ────────────────────────

function createNumberTexture(
  label: number | string,
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

  const text = String(label);
  const basePx = text.length > 1 ? 48 : 56;
  const px = Math.round(basePx * sizeMultiplier);

  ctx.clearRect(0, 0, size, size);
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 4;
  ctx.fillStyle = color;
  ctx.font = `${fontWeight} ${px}px ${fontFamily}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ─── Create emoji texture via canvas ─────────────────────────

function createEmojiTexture(faceValue: number | string, faceCount: number, skinId: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  // Normalize value to 1-20 range for emoji mapping
  const numValue = typeof faceValue === 'number' ? faceValue : parseInt(faceValue, 10) || 0;
  const normalized = faceCount === 20
    ? numValue
    : Math.max(1, Math.round((numValue / Math.max(faceCount - 1, 1)) * 19) + 1);

  const emoji = getEmojiForFace(normalized, skinId);
  ctx.font = '52px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 - 8);

  // Small number below
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText(String(faceValue), size / 2, size - 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ─── Face labels on the die ──────────────────────────────────

function FaceLabels({ faces, faceLabels, labelConfig, skin, labelStyle, labelSize, labelFont, labelWeight, diceType }: {
  faces: FaceData[];
  faceLabels: (number | string)[];
  labelConfig: { quadSize: number; liftMultiplier: number; fontSizeMultiplier: number };
  skin: DiceSkin;
  labelStyle?: 'numbers' | 'emoji' | 'hidden';
  labelSize?: number;
  labelFont?: string;
  labelWeight?: string;
  diceType: DiceType;
}) {
  const effectiveStyle = labelStyle ?? (skin.type === 'emoji' ? 'emoji' : 'numbers');
  const sizeMul = (labelSize ?? 1.0) * labelConfig.fontSizeMultiplier;

  const textures = useMemo(() => {
    if (effectiveStyle === 'hidden') return null;
    if (effectiveStyle === 'emoji') {
      return faceLabels.map((label) =>
        createEmojiTexture(label, faceLabels.length, skin.id),
      );
    }
    return faceLabels.map((label) =>
      createNumberTexture(label, skin.label, skin.labelShadow, sizeMul, labelFont, labelWeight),
    );
  }, [effectiveStyle, faceLabels, skin.id, skin.label, skin.labelShadow, sizeMul, labelFont, labelWeight]);

  if (!textures) return null;

  return (
    <>
      {faces.map((face, i) => {
        if (i >= textures.length) return null;
        // For Platonic solids, face centers are equidistant from origin so
        // multiplyScalar works. For D10/D100 kites, centers are deep inside
        // the shape, so we push outward along the face normal instead.
        const isD10Shape = diceType === 'd10' || diceType === 'd100';
        const pos = isD10Shape
          ? face.center.clone().addScaledVector(face.normal, 0.01)
          : face.center.clone().multiplyScalar(labelConfig.liftMultiplier);
        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal);

        return (
          <mesh key={i} position={pos} quaternion={quat}>
            <planeGeometry args={[labelConfig.quadSize, labelConfig.quadSize]} />
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
  shaderColors?: { color1: string; color2: string; color3: string };
  speed?: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const defaults = SHADER_DEFAULTS[shaderKey];
  const c1 = shaderColors?.color1 ?? defaults?.color1 ?? '#FFFFFF';
  const c2 = shaderColors?.color2 ?? defaults?.color2 ?? '#FFFFFF';
  const c3 = shaderColors?.color3 ?? defaults?.color3 ?? '#FFFFFF';

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

function ImageDiceMaterial({ url, bodyColor, metalness, roughness, tile = false }: {
  url: string;
  bodyColor: string;
  metalness: number;
  roughness: number;
  tile?: boolean;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const prevTexture = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!active) return;
      const canvas = document.createElement('canvas');
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      const tex = new THREE.CanvasTexture(canvas);
      if (tile) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 3);
      }
      tex.needsUpdate = true;
      prevTexture.current?.dispose();
      prevTexture.current = tex;
      setTexture(tex);
    };
    img.src = url;

    return () => { active = false; };
  }, [url, tile]);

  useEffect(() => {
    if (matRef.current) matRef.current.needsUpdate = true;
  }, [texture]);

  return (
    <meshStandardMaterial
      ref={matRef}
      map={texture ?? undefined}
      color={texture ? '#ffffff' : bodyColor}
      metalness={metalness}
      roughness={roughness}
    />
  );
}

// ─── Overlay shader mesh (transparent layer on top of base) ───

function OverlayMesh({ shaderKey, opacity, diceType }: {
  shaderKey: string;
  opacity: number;
  diceType: DiceType;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const defaults = SHADER_DEFAULTS[shaderKey];
  const config = DICE_CONFIGS[diceType];

  const geometry = useMemo(
    () => config.createGeometry(config.radius * 1.001),
    [config],
  );

  const material = useMemo(() => {
    const code = getShaderCode(shaderKey);
    if (!code) return null;

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

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
      matRef.current.uniforms.uOpacity.value = opacity;
    }
  });

  if (!material) return null;

  return (
    <mesh>
      <primitive object={geometry} attach="geometry" />
      <primitive ref={matRef} object={material} attach="material" />
    </mesh>
  );
}

// ─── Animated Die with rigid body physics ────────────────────

type Phase = 'idle' | 'shrink' | 'flight' | 'decel' | 'settle' | 'present';

const SHRINK_DUR = 0.25;
const FLIGHT_DUR = 1.3;
const DECEL_DUR = 0.8;
const SETTLE_DUR = 0.3;
const PRESENT_DUR = 0.35;

function AnimatedDie({
  rolling,
  onSettled,
  skin,
  isNat20,
  diceType,
}: {
  rolling: boolean;
  onSettled: (value: number | string) => void;
  skin: DiceSkin;
  isNat20?: boolean;
  diceType: DiceType;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const config = DICE_CONFIGS[diceType];
  const faces = useMemo(() => getFaceData(diceType), [diceType]);

  // Create a fresh geometry per dice type. Must not be shared across renders
  // because R3F's <primitive> doesn't reconcile geometry object swaps well.
  const geometry = useMemo(() => {
    const geo = config.createGeometry(config.radius);
    // Ensure non-indexed for flat shading on all types
    if (geo.index) return geo.toNonIndexed();
    return geo;
  }, [config]);

  // Set initial orientation to show highest-value face on mount and type change
  useEffect(() => {
    if (groupRef.current) {
      const q = getInitialQuat(diceType, TO_CAMERA);
      groupRef.current.quaternion.copy(q);
    }
  }, [diceType]);

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
    resultValue: config.faceLabels[config.faceLabels.length - 1] as number | string,
    resultReported: false,
  });

  const scaleRef = useRef(1);
  const lastRolling = useRef(false);

  function setPhase(phase: Phase) {
    state.current.phase = phase;
    state.current.phaseStart = 0;
  }

  function computeLanding(group: THREE.Group): { value: number | string; quat: THREE.Quaternion } {
    const worldNormal = new THREE.Vector3();
    let bestDot = -Infinity;
    let bestIdx = 0;

    for (let i = 0; i < faces.length; i++) {
      worldNormal.copy(faces[i].normal).applyQuaternion(group.quaternion);
      const dot = worldNormal.dot(TO_CAMERA);
      if (dot > bestDot) {
        bestDot = dot;
        bestIdx = i;
      }
    }

    worldNormal.copy(faces[bestIdx].normal).applyQuaternion(group.quaternion);
    const correction = new THREE.Quaternion().setFromUnitVectors(worldNormal, TO_CAMERA);
    const landingQuat = group.quaternion.clone().premultiply(correction);

    return { value: config.faceLabels[bestIdx], quat: landingQuat };
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
  const customConfig = (skin as DiceSkin & { customConfig?: CustomDiceSkinConfig }).customConfig;
  const labelStyle = customConfig?.labelStyle;
  const isImage = customConfig?.baseType === 'image' && !!customConfig?.wrapImageUrl;

  return (
    <group ref={groupRef}>
      <mesh castShadow key={diceType}>
        <primitive object={geometry} attach="geometry" />
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
            tile={customConfig?.imageMode === 'tile'}
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
          diceType={diceType}
        />
      )}
      <FaceLabels
        faces={faces}
        faceLabels={config.faceLabels}
        labelConfig={config.labelConfig}
        skin={skin}
        labelStyle={labelStyle}
        labelSize={customConfig?.labelSize}
        labelFont={customConfig?.labelFont}
        labelWeight={customConfig?.labelWeight}
        diceType={diceType}
      />
    </group>
  );
}

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
  onSettled: (value: number | string) => void;
  /** Full skin object -- controls colors, material, and label style */
  skin?: DiceSkin;
  /** When true, adds pulsing gold light and larger present scale */
  isNat20?: boolean;
  /** Which dice type to render (default: 'd20') */
  diceType?: DiceType;
}

export default function PhysicsDice({ rolling, onSettled, skin, isNat20, diceType = 'd20' }: PhysicsDiceProps) {
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
        <AnimatedDie
          rolling={rolling}
          onSettled={onSettled}
          skin={activeSkin}
          isNat20={isNat20}
          diceType={diceType}
        />
      </Canvas>
    </div>
  );
}
