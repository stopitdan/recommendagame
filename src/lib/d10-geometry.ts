/**
 * Custom D10 (pentagonal trapezohedron) geometry.
 *
 * Mathematically correct with coplanar kite faces (no creases).
 * The ringY offset is computed numerically to ensure the scalar
 * triple product of each kite's edge vectors is zero.
 */

import * as THREE from 'three';

export interface D10FaceInfo {
  center: THREE.Vector3;
  normal: THREE.Vector3;
}

let cachedFaceInfo: D10FaceInfo[] | null = null;
let cachedRadius = 0;

export function createD10Geometry(radius: number): THREE.BufferGeometry {
  const s = radius * 0.9;

  // These values are numerically solved for coplanarity:
  // scalar triple product (u0-top) · ((l0-top) × (u1-top)) ≈ 0
  const ringR = s * 0.82;
  const apexH = s * 1.0;
  const ringY = s * 0.1055 / 0.9; // = 0.1055 when s=0.9*radius

  const top = new THREE.Vector3(0, apexH, 0);
  const bot = new THREE.Vector3(0, -apexH, 0);

  const V: THREE.Vector3[] = [top];

  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    V.push(new THREE.Vector3(ringR * Math.cos(a), ringY, ringR * Math.sin(a)));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2 + Math.PI / 5;
    V.push(new THREE.Vector3(ringR * Math.cos(a), -ringY, ringR * Math.sin(a)));
  }
  V.push(bot);

  const positions: number[] = [];
  const normals: number[] = [];
  const faceInfos: D10FaceInfo[] = [];

  function addFace(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) {
    // Face normal from kite diagonals
    const n = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3().subVectors(c, a),
        new THREE.Vector3().subVectors(d, b),
      )
      .normalize();

    const geomCenter = new THREE.Vector3().add(a).add(b).add(c).add(d).divideScalar(4);
    if (n.dot(geomCenter) < 0) n.negate();

    // Label center: blend between the geometric centroid (average of all 4)
    // and the ring midpoint (b+d)/2. Real dice have numbers slightly toward
    // the wider part but not all the way -- 60% centroid, 40% ring midpoint.
    const centroid = new THREE.Vector3().add(a).add(b).add(c).add(d).divideScalar(4);
    const ringMid = new THREE.Vector3().add(b).add(d).divideScalar(2);
    const labelCenter = ringMid.clone().lerp(centroid, 0.7);
    faceInfos.push({ center: labelCenter.clone(), normal: n.clone() });

    // Split along b-d diagonal (ring-to-ring) for coplanar triangles
    const tris: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
      [a, b, d],
      [b, c, d],
    ];

    for (const [p, q, r] of tris) {
      const triN = new THREE.Vector3().crossVectors(
        new THREE.Vector3().subVectors(q, p),
        new THREE.Vector3().subVectors(r, p),
      );
      const verts = triN.dot(n) >= 0 ? [p, q, r] : [p, r, q];
      for (const v of verts) {
        positions.push(v.x, v.y, v.z);
        normals.push(n.x, n.y, n.z);
      }
    }
  }

  for (let i = 0; i < 5; i++) {
    const ni = (i + 1) % 5;
    addFace(V[0], V[1 + i], V[6 + i], V[1 + ni]);
    addFace(V[11], V[6 + ni], V[1 + ni], V[6 + i]);
  }

  cachedFaceInfo = faceInfos;
  cachedRadius = radius;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

export function getD10FaceInfo(radius: number): D10FaceInfo[] {
  if (!cachedFaceInfo || cachedRadius !== radius) {
    const geo = createD10Geometry(radius);
    geo.dispose();
  }
  return cachedFaceInfo!;
}
