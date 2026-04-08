/**
 * Custom D10 (pentagonal trapezohedron) geometry.
 *
 * A D10 has 10 kite-shaped faces, 12 vertices, and 20 edges.
 * Three.js has no built-in for this shape. We construct it as the
 * dual of a pentagonal antiprism.
 *
 * The geometry is non-indexed (flat shading compatible) with each
 * kite split into 2 triangles = 20 triangles total.
 */

import * as THREE from 'three';

/**
 * Creates a D10 pentagonal trapezohedron BufferGeometry.
 * @param radius - Approximate outer radius (vertex distance from center)
 */
export function createD10Geometry(radius: number): THREE.BufferGeometry {
  // Pentagonal trapezohedron construction:
  // - Top apex and bottom apex
  // - Upper ring of 5 vertices (pentagon)
  // - Lower ring of 5 vertices (pentagon, rotated 36 degrees)

  const topApex = new THREE.Vector3(0, radius, 0);
  const bottomApex = new THREE.Vector3(0, -radius, 0);

  // Ring height relative to center -- upper ring slightly above, lower slightly below
  const ringY = radius * 0.31;
  const ringRadius = radius * 0.85;

  const upperRing: THREE.Vector3[] = [];
  const lowerRing: THREE.Vector3[] = [];

  for (let i = 0; i < 5; i++) {
    // Upper ring vertices
    const upperAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    upperRing.push(new THREE.Vector3(
      ringRadius * Math.cos(upperAngle),
      ringY,
      ringRadius * Math.sin(upperAngle),
    ));

    // Lower ring -- rotated 36 degrees (pi/5) from upper
    const lowerAngle = upperAngle + Math.PI / 5;
    lowerRing.push(new THREE.Vector3(
      ringRadius * Math.cos(lowerAngle),
      -ringY,
      ringRadius * Math.sin(lowerAngle),
    ));
  }

  // Build 10 kite faces, each as 2 triangles.
  // Upper kites: topApex -> upperRing[i] -> lowerRing[i] -> upperRing[(i+1)%5]
  // Lower kites: bottomApex -> lowerRing[i] -> upperRing[(i+1)%5] -> lowerRing[(i+1)%5]
  const positions: number[] = [];

  for (let i = 0; i < 5; i++) {
    const next = (i + 1) % 5;

    // Upper kite face: topApex, upperRing[i], lowerRing[i], upperRing[next]
    // Triangle 1: topApex, upperRing[i], lowerRing[i]
    positions.push(
      topApex.x, topApex.y, topApex.z,
      upperRing[i].x, upperRing[i].y, upperRing[i].z,
      lowerRing[i].x, lowerRing[i].y, lowerRing[i].z,
    );
    // Triangle 2: topApex, lowerRing[i], upperRing[next]
    positions.push(
      topApex.x, topApex.y, topApex.z,
      lowerRing[i].x, lowerRing[i].y, lowerRing[i].z,
      upperRing[next].x, upperRing[next].y, upperRing[next].z,
    );

    // Lower kite face: bottomApex, lowerRing[i], upperRing[next], lowerRing[next]
    // Triangle 1: bottomApex, lowerRing[i], upperRing[next]
    positions.push(
      bottomApex.x, bottomApex.y, bottomApex.z,
      lowerRing[i].x, lowerRing[i].y, lowerRing[i].z,
      upperRing[next].x, upperRing[next].y, upperRing[next].z,
    );
    // Triangle 2: bottomApex, upperRing[next], lowerRing[next]
    positions.push(
      bottomApex.x, bottomApex.y, bottomApex.z,
      upperRing[next].x, upperRing[next].y, upperRing[next].z,
      lowerRing[next].x, lowerRing[next].y, lowerRing[next].z,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}
