/**
 * GLSL Shaders for Animated Dice Skins
 *
 * Each shader receives:
 * - vPosition: object-space vertex position (from icosahedron)
 * - vNormal: view-space normal (flat per face due to non-indexed geometry)
 * - uTime: elapsed time in seconds
 *
 * The icosahedron (detail=0) has non-indexed geometry, so normals are
 * naturally flat per face — no extra flat-shading logic needed.
 */

const VERTEX_SHADER = `
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Shared noise utilities prepended to all fragment shaders */
const NOISE_LIB = `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                 mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                 mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  vec3 shift = vec3(100.0);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

float lighting(vec3 n) {
  vec3 l = normalize(vec3(0.5, 0.7, 1.0));
  return 0.3 + 0.7 * max(dot(n, l), 0.0);
}
`;

function frag(body: string): string {
  return `
precision highp float;
uniform float uTime;
varying vec3 vPosition;
varying vec3 vNormal;
${NOISE_LIB}
void main() {
${body}
}
`;
}

// ─── Individual Effect Shaders ─────────────────────────────────

const FIRE = frag(`
  vec3 p = vPosition * 2.5;
  p.y -= uTime * 1.8;
  float n = fbm(p);
  float fire = smoothstep(0.05, 0.95, n + vPosition.y * 0.4);
  vec3 col = mix(vec3(0.15, 0.0, 0.0), vec3(1.0, 0.35, 0.0), fire);
  col = mix(col, vec3(1.0, 0.9, 0.3), smoothstep(0.55, 1.0, fire));
  col = mix(col, vec3(1.0, 1.0, 0.9), smoothstep(0.85, 1.0, fire));
  col *= lighting(vNormal) * 0.7 + 0.3;
  gl_FragColor = vec4(col, 1.0);
`);

const WATER = frag(`
  vec3 p = vPosition * 3.0;
  float n1 = noise(p + vec3(uTime * 0.35, 0.0, uTime * 0.25));
  float n2 = noise(p * 1.5 + vec3(-uTime * 0.2, uTime * 0.4, 0.0));
  float caustic = pow(abs(sin(n1 * 6.28 + n2 * 6.28)), 3.0);

  vec3 deep = vec3(0.01, 0.08, 0.35);
  vec3 mid = vec3(0.05, 0.35, 0.7);
  vec3 light = vec3(0.6, 0.9, 1.0);

  vec3 col = mix(deep, mid, n1);
  col = mix(col, light, caustic * 0.6);
  col *= lighting(vNormal);
  gl_FragColor = vec4(col, 1.0);
`);

const GALAXY = frag(`
  vec3 p = vPosition * 2.0;
  float angle = uTime * 0.12;
  float c = cos(angle), s = sin(angle);
  p.xz = mat2(c, -s, s, c) * p.xz;

  float n = fbm(p * 1.5);
  vec3 nebula = mix(vec3(0.04, 0.0, 0.12), vec3(0.3, 0.08, 0.5), n);
  nebula = mix(nebula, vec3(0.08, 0.18, 0.55), fbm(p * 2.0 + 100.0));
  nebula = mix(nebula, vec3(0.5, 0.1, 0.3), fbm(p * 1.2 + 200.0) * 0.4);

  // Stars
  float star = smoothstep(0.97, 1.0, hash(floor(p * 20.0)));
  float twinkle = sin(uTime * 3.5 + hash(floor(p * 20.0)) * 100.0) * 0.5 + 0.5;
  nebula += star * twinkle * vec3(1.0, 0.95, 0.85) * 1.5;

  nebula *= lighting(vNormal) * 0.6 + 0.4;
  gl_FragColor = vec4(nebula, 1.0);
`);

const HOLOGRAPHIC = frag(`
  float fresnel = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
  float hue = fract(fresnel * 2.5 + vPosition.y * 0.6 + uTime * 0.35);
  vec3 col = 0.5 + 0.5 * cos(6.2832 * (hue + vec3(0.0, 0.33, 0.67)));

  // Shimmer sparkle
  float sparkle = noise(vPosition * 15.0 + vec3(uTime * 2.0));
  col += smoothstep(0.7, 0.9, sparkle) * 0.4;
  col *= 0.65 + 0.35 * fresnel;
  col *= lighting(vNormal) * 0.8 + 0.2;
  gl_FragColor = vec4(col, 1.0);
`);

const ELECTRIC = frag(`
  vec3 p = vPosition * 4.0;
  float n1 = noise(p + vec3(uTime * 2.5));
  float n2 = noise(p * 2.0 - vec3(uTime * 3.5));
  float bolt = pow(abs(sin(n1 * 10.0 + n2 * 8.0)), 8.0);
  float pulse = sin(uTime * 5.0) * 0.3 + 0.7;

  vec3 dark = vec3(0.01, 0.01, 0.08);
  vec3 blue = vec3(0.15, 0.35, 1.0);
  vec3 white = vec3(0.85, 0.92, 1.0);

  vec3 col = mix(dark, blue, n1 * 0.4);
  col = mix(col, white, bolt * pulse);
  // Occasional bright flash
  float flash = smoothstep(0.95, 1.0, sin(uTime * 7.0 + n1 * 3.0));
  col += flash * vec3(0.3, 0.5, 1.0);
  col *= lighting(vNormal) * 0.7 + 0.3;
  gl_FragColor = vec4(col, 1.0);
`);

const TOXIC = frag(`
  vec3 p = vPosition * 3.0;
  float n = fbm(p + vec3(0.0, uTime * 0.35, 0.0));
  float bubble = smoothstep(0.52, 0.58, n) * smoothstep(0.65, 0.58, n);
  float glow = sin(uTime * 2.5 + n * 6.28) * 0.2 + 0.8;

  vec3 dark = vec3(0.01, 0.04, 0.0);
  vec3 green = vec3(0.08, 0.7, 0.08);
  vec3 bright = vec3(0.35, 1.0, 0.15);

  vec3 col = mix(dark, green * glow, n);
  col = mix(col, bright, bubble * 1.3);
  // Radioactive pulse
  col += vec3(0.0, 0.15, 0.0) * sin(uTime * 1.5) * 0.5 + 0.5;
  col *= lighting(vNormal);
  gl_FragColor = vec4(col, 1.0);
`);

const MARBLE = frag(`
  vec3 p = vPosition * 2.5;
  float n = fbm(p);
  float vein = abs(sin((p.x + p.y * 0.7 + p.z * 0.5) * 3.5 + n * 10.0));
  vein = pow(vein, 0.4);

  vec3 base = vec3(0.92, 0.9, 0.87);
  vec3 veinCol = vec3(0.18, 0.12, 0.25);
  vec3 veinCol2 = vec3(0.3, 0.25, 0.2);

  // Subtle animation — very slow swirl
  float swirl = sin(uTime * 0.15) * 0.03;
  vec3 col = mix(veinCol, base, vein + swirl);
  col = mix(col, veinCol2, smoothstep(0.3, 0.35, 1.0 - vein) * 0.4);
  col *= lighting(vNormal);
  gl_FragColor = vec4(col, 1.0);
`);

const MAGMA = frag(`
  vec3 p = vPosition * 3.5;
  float n1 = noise(p + vec3(uTime * 0.12));
  float n2 = noise(p * 2.0 + vec3(uTime * 0.18));
  float crack = smoothstep(0.38, 0.5, abs(n1 - 0.5)) * smoothstep(0.38, 0.5, abs(n2 - 0.5));
  float glow = 1.0 - crack;
  glow = pow(glow, 2.5);
  float pulse = sin(uTime * 0.8 + n1 * 4.0) * 0.15 + 0.85;

  vec3 dark = vec3(0.06, 0.03, 0.02);
  vec3 lava = vec3(1.0, 0.25, 0.0);
  vec3 hot = vec3(1.0, 0.85, 0.2);

  vec3 col = mix(dark, lava * pulse, glow);
  col = mix(col, hot, glow * glow);
  col *= lighting(vNormal) * 0.6 + 0.4;
  gl_FragColor = vec4(col, 1.0);
`);

const FROST = frag(`
  vec3 p = vPosition * 4.5;
  float n = noise(p);
  float crystal = abs(sin(p.x * 6.0 + n * 3.0) * sin(p.y * 6.0 + n * 3.0) * sin(p.z * 6.0 + n * 3.0));
  crystal = pow(crystal, 0.25);
  float shimmer = sin(uTime * 1.8 + n * 12.0) * 0.08 + 0.92;

  vec3 deep = vec3(0.15, 0.35, 0.55);
  vec3 ice = vec3(0.6, 0.88, 0.98);
  vec3 sparkle = vec3(1.0, 1.0, 1.0);

  vec3 col = mix(deep, ice, crystal);
  col = mix(col, sparkle, pow(crystal, 3.0) * 0.6);
  col *= shimmer;
  // Ice sparkle dots
  float sp = smoothstep(0.96, 1.0, hash(floor(p * 8.0)));
  col += sp * sin(uTime * 4.0 + hash(floor(p * 8.0)) * 50.0) * 0.5 * vec3(0.8, 0.9, 1.0);
  col *= lighting(vNormal);
  gl_FragColor = vec4(col, 1.0);
`);

const DISCO = frag(`
  float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.5);
  vec3 p = vPosition * 6.0;

  float sp1 = smoothstep(0.65, 0.72, sin(p.x + uTime * 2.2) * sin(p.y + uTime * 1.7));
  float sp2 = smoothstep(0.65, 0.72, sin(p.y + uTime * 1.9) * sin(p.z + uTime * 2.5));
  float sp3 = smoothstep(0.65, 0.72, sin(p.z + uTime * 1.5) * sin(p.x + uTime * 2.8));

  vec3 base = vec3(0.75, 0.75, 0.8) + fresnel * 0.25;
  // Colorful light spots
  base += sp1 * vec3(1.0, 0.15, 0.4) * 0.8;
  base += sp2 * vec3(0.15, 0.4, 1.0) * 0.8;
  base += sp3 * vec3(0.15, 1.0, 0.3) * 0.8;
  // Extra sparkle
  float sparkle = smoothstep(0.92, 1.0, hash(floor(p * 3.0)));
  float blink = sin(uTime * 6.0 + hash(floor(p * 3.0)) * 80.0) * 0.5 + 0.5;
  base += sparkle * blink * vec3(1.0, 0.95, 0.8) * 0.6;

  base *= lighting(vNormal);
  gl_FragColor = vec4(base, 1.0);
`);

const BLOOD_MOON = frag(`
  vec3 p = vPosition * 2.5;
  float n = fbm(p + vec3(uTime * 0.08, uTime * 0.05, 0.0));
  float crater = smoothstep(0.4, 0.6, noise(p * 3.0));

  vec3 dark = vec3(0.12, 0.02, 0.02);
  vec3 crimson = vec3(0.6, 0.05, 0.05);
  vec3 glow = vec3(0.9, 0.15, 0.08);

  float pulse = sin(uTime * 0.8) * 0.15 + 0.85;
  vec3 col = mix(dark, crimson, n * pulse);
  col = mix(col, glow, smoothstep(0.6, 0.9, n) * 0.5);
  col *= 0.7 + 0.3 * crater;
  col *= lighting(vNormal) * 0.7 + 0.3;
  gl_FragColor = vec4(col, 1.0);
`);

// ─── Shader Registry ───────────────────────────────────────────

const SHADERS: Record<string, string> = {
  fire: FIRE,
  water: WATER,
  galaxy: GALAXY,
  holographic: HOLOGRAPHIC,
  electric: ELECTRIC,
  toxic: TOXIC,
  marble: MARBLE,
  magma: MAGMA,
  frost: FROST,
  disco: DISCO,
  'blood-moon': BLOOD_MOON,
};

/**
 * Default colors per shader key — these are the original hardcoded values.
 * Custom dice can override any of these via shaderColors.
 */
export const SHADER_DEFAULTS: Record<string, { color1: string; color2: string; color3: string }> = {
  fire:         { color1: '#CC2200', color2: '#FF6D00', color3: '#FFD700' },
  water:        { color1: '#01083A', color2: '#0A5F8A', color3: '#60C8F0' },
  galaxy:       { color1: '#0A0020', color2: '#3D1273', color3: '#5020A0' },
  holographic:  { color1: '#AAAACC', color2: '#FFFFFF', color3: '#FFFFFF' },
  electric:     { color1: '#0A0A30', color2: '#1535FF', color3: '#85B2FF' },
  toxic:        { color1: '#0A2000', color2: '#08B008', color3: '#35FF15' },
  marble:       { color1: '#E8E4E0', color2: '#181225', color3: '#C8B8A0' },
  magma:        { color1: '#2A0A00', color2: '#FF4400', color3: '#FFD720' },
  frost:        { color1: '#153555', color2: '#60BBE0', color3: '#FFFFFF' },
  disco:        { color1: '#C0C0CC', color2: '#FF1493', color3: '#33FF77' },
  'blood-moon': { color1: '#120202', color2: '#600505', color3: '#901508' },
};

/** All available shader keys */
export const SHADER_KEYS = Object.keys(SHADERS);

export function getShaderCode(key: string): { vertex: string; fragment: string } | null {
  const fragment = SHADERS[key];
  if (!fragment) return null;
  return { vertex: VERTEX_SHADER, fragment };
}

/**
 * Returns shader code with uColor1/uColor2/uColor3 uniforms prepended.
 * The shader body itself still uses its hardcoded colors, but the uniforms
 * are available for the OverlayMesh to use for tinting/mixing.
 * When custom colors are provided, they're set as uniform values on the material.
 */
export function getParameterizedShaderCode(key: string): { vertex: string; fragment: string } | null {
  const fragment = SHADERS[key];
  if (!fragment) return null;

  // Add color uniforms to vertex shader
  const paramVertex = `
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
${VERTEX_SHADER}`;

  // Add color uniforms to fragment shader — prepend before precision declaration
  const paramFragment = fragment.replace(
    'precision highp float;',
    `precision highp float;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;`,
  );

  return { vertex: paramVertex, fragment: paramFragment };
}

export function hasShader(key: string): boolean {
  return key in SHADERS;
}
