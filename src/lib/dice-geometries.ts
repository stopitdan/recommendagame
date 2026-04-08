/**
 * Dice Geometry Registry
 *
 * Maps each D&D 5e dice type to its Three.js geometry, face data computation,
 * label configuration, and face labels. This is the core abstraction that
 * makes PhysicsDice polymorphic across dice types.
 */

import * as THREE from 'three';
import { createD10Geometry } from './d10-geometry';

// ─── Types ──────────────────────────────────────────────────

export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';

export interface FaceData {
  center: THREE.Vector3;
  normal: THREE.Vector3;
}

export interface DiceLabelConfig {
  /** Size of the label quad (plane) placed on each face */
  quadSize: number;
  /** Multiplier for how far labels float above the surface */
  liftMultiplier: number;
  /** Font size multiplier relative to the default */
  fontSizeMultiplier: number;
}

export interface DiceGeometryConfig {
  type: DiceType;
  faceCount: number;
  /** Number of triangles per logical face in the geometry buffer */
  trisPerFace: number;
  /** Creates the Three.js geometry for this dice type */
  createGeometry: (radius: number) => THREE.BufferGeometry;
  /** Label values for each face (numbers or strings for D100) */
  faceLabels: (number | string)[];
  /** Label rendering configuration */
  labelConfig: DiceLabelConfig;
  /** Geometry radius */
  radius: number;
}

// ─── Face Data Computation ──────────────────────────────────

/**
 * Compute face centers and normals from a BufferGeometry.
 * Groups every `trisPerFace` consecutive triangles into one logical face.
 */
export function computeFaceData(geometry: THREE.BufferGeometry, trisPerFace: number): FaceData[] {
  const pos = geometry.attributes.position;
  const faces: FaceData[] = [];
  const verticesPerFace = trisPerFace * 3;

  for (let i = 0; i < pos.count; i += verticesPerFace) {
    // Collect all vertices for this logical face
    const center = new THREE.Vector3();
    for (let v = 0; v < verticesPerFace; v++) {
      center.x += pos.getX(i + v);
      center.y += pos.getY(i + v);
      center.z += pos.getZ(i + v);
    }
    center.divideScalar(verticesPerFace);

    // Compute normal from the first triangle of this face
    const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

    const normal = new THREE.Vector3()
      .crossVectors(b.clone().sub(a), c.clone().sub(a))
      .normalize();

    // Ensure normal points outward (away from origin)
    if (normal.dot(center) < 0) normal.negate();

    faces.push({ center, normal });
  }

  return faces;
}

// ─── Geometry Factories ─────────────────────────────────────

function createD4(radius: number): THREE.BufferGeometry {
  return new THREE.TetrahedronGeometry(radius, 0);
}

function createD6(radius: number): THREE.BufferGeometry {
  // BoxGeometry is indexed; convert to non-indexed for flat shading
  const box = new THREE.BoxGeometry(radius * 1.15, radius * 1.15, radius * 1.15);
  return box.toNonIndexed();
}

function createD8(radius: number): THREE.BufferGeometry {
  return new THREE.OctahedronGeometry(radius, 0);
}

function createD10(radius: number): THREE.BufferGeometry {
  return createD10Geometry(radius);
}

function createD12(radius: number): THREE.BufferGeometry {
  return new THREE.DodecahedronGeometry(radius, 0);
}

function createD20(radius: number): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(radius, 0);
}

// ─── Registry ───────────────────────────────────────────────

export const DICE_CONFIGS: Record<DiceType, DiceGeometryConfig> = {
  d4: {
    type: 'd4',
    faceCount: 4,
    trisPerFace: 1,
    createGeometry: createD4,
    faceLabels: [1, 2, 3, 4],
    labelConfig: { quadSize: 0.45, liftMultiplier: 1.04, fontSizeMultiplier: 1.2 },
    radius: 0.85,
  },
  d6: {
    type: 'd6',
    faceCount: 6,
    trisPerFace: 2,
    createGeometry: createD6,
    faceLabels: [1, 2, 3, 4, 5, 6],
    labelConfig: { quadSize: 0.55, liftMultiplier: 1.01, fontSizeMultiplier: 1.1 },
    radius: 0.85,
  },
  d8: {
    type: 'd8',
    faceCount: 8,
    trisPerFace: 1,
    createGeometry: createD8,
    faceLabels: [1, 2, 3, 4, 5, 6, 7, 8],
    labelConfig: { quadSize: 0.40, liftMultiplier: 1.03, fontSizeMultiplier: 1.0 },
    radius: 0.85,
  },
  d10: {
    type: 'd10',
    faceCount: 10,
    trisPerFace: 2,
    createGeometry: createD10,
    faceLabels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    labelConfig: { quadSize: 0.35, liftMultiplier: 1.03, fontSizeMultiplier: 1.0 },
    radius: 0.85,
  },
  d12: {
    type: 'd12',
    faceCount: 12,
    trisPerFace: 3,
    createGeometry: createD12,
    faceLabels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    labelConfig: { quadSize: 0.40, liftMultiplier: 1.02, fontSizeMultiplier: 0.95 },
    radius: 0.85,
  },
  d20: {
    type: 'd20',
    faceCount: 20,
    trisPerFace: 1,
    createGeometry: createD20,
    faceLabels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    labelConfig: { quadSize: 0.38, liftMultiplier: 1.02, fontSizeMultiplier: 1.0 },
    radius: 0.85,
  },
};

// ─── Cached Face Data ───────────────────────────────────────

const faceDataCache = new Map<DiceType, FaceData[]>();

/**
 * Get face data for a dice type (computed once, then cached).
 */
export function getFaceData(type: DiceType): FaceData[] {
  let faces = faceDataCache.get(type);
  if (!faces) {
    const config = DICE_CONFIGS[type];
    const geo = config.createGeometry(config.radius);
    faces = computeFaceData(geo, config.trisPerFace);
    geo.dispose();
    faceDataCache.set(type, faces);
  }
  return faces;
}

/**
 * Compute the initial quaternion that orients the highest-value face toward the camera.
 */
export function getInitialQuat(type: DiceType, cameraDir: THREE.Vector3): THREE.Quaternion {
  const faces = getFaceData(type);
  const lastFace = faces[faces.length - 1];
  return new THREE.Quaternion().setFromUnitVectors(lastFace.normal, cameraDir.clone().normalize());
}

/**
 * All available dice types in display order.
 */
export const ALL_DICE_TYPES: DiceType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

/**
 * Get the maximum numeric value for a dice type.
 */
export function getMaxValue(type: DiceType): number | string {
  const labels = DICE_CONFIGS[type].faceLabels;
  return labels[labels.length - 1];
}

/**
 * Get the minimum value for a dice type.
 */
export function getMinValue(type: DiceType): number | string {
  return DICE_CONFIGS[type].faceLabels[0];
}
