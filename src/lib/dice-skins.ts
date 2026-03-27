/**
 * Dice Skin Presets
 *
 * Three skin types:
 * - solid: Standard MeshStandardMaterial with a single body color
 * - shader: Custom GLSL fragment shader with time-based animation
 * - emoji: Solid body color but face labels are expressive emoji instead of numbers
 *
 * To add a new skin: add an entry to DICE_SKINS. That's it.
 */

export type DiceSkinType = 'solid' | 'shader' | 'emoji';

export interface DiceSkin {
  id: string;
  name: string;
  emoji: string;
  type: DiceSkinType;
  /** Main die body color (solid/emoji) or fallback for shader */
  body: string;
  /** Accent/point light color */
  accent: string;
  /** Number label color */
  label: string;
  /** Label shadow color */
  labelShadow: string;
  /** Material metalness 0-1 (solid/emoji only) */
  metalness: number;
  /** Material roughness 0-1 (solid/emoji only) */
  roughness: number;
  /** Key into dice-shaders registry (shader skins only) */
  shaderKey?: string;
  /** CSS background for the customizer swatch */
  swatchBg: string;
  /** Optional CSS animation name for animated swatches */
  swatchAnimation?: string;
  /** Whether this skin requires an account */
  requiresAccount: boolean;
}

export const DEFAULT_SKIN_ID = 'classic-purple';

export const DICE_SKINS: DiceSkin[] = [
  // ── Solid Skins ───────────────────────────────────────────────

  {
    id: 'classic-purple',
    name: 'Classic Purple',
    emoji: '🎲',
    type: 'solid',
    body: '#5B4FDB',
    accent: '#FF6D3F',
    label: '#FFFFFF',
    labelShadow: 'rgba(0,0,0,0.5)',
    metalness: 0.3,
    roughness: 0.4,
    swatchBg: 'radial-gradient(circle at 35% 35%, #7B71E8, #5B4FDB)',
    requiresAccount: false,
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    emoji: '🖤',
    type: 'solid',
    body: '#2C2C2C',
    accent: '#FF4444',
    label: '#E0E0E0',
    labelShadow: 'rgba(255,68,68,0.3)',
    metalness: 0.6,
    roughness: 0.2,
    swatchBg: 'radial-gradient(circle at 35% 35%, #555, #2C2C2C)',
    requiresAccount: true,
  },
  {
    id: 'golden-idol',
    name: 'Golden Idol',
    emoji: '✨',
    type: 'solid',
    body: '#B8860B',
    accent: '#FFD700',
    label: '#FFFDF0',
    labelShadow: 'rgba(80,50,0,0.6)',
    metalness: 0.7,
    roughness: 0.15,
    swatchBg: 'radial-gradient(circle at 35% 35%, #FFD700, #B8860B)',
    requiresAccount: true,
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    emoji: '🍬',
    type: 'solid',
    body: '#FF69B4',
    accent: '#FFB6C1',
    label: '#FFFFFF',
    labelShadow: 'rgba(200,50,100,0.4)',
    metalness: 0.15,
    roughness: 0.5,
    swatchBg: 'radial-gradient(circle at 35% 35%, #FFB6C1, #FF69B4)',
    requiresAccount: true,
  },
  {
    id: 'royal-sapphire',
    name: 'Royal Sapphire',
    emoji: '💎',
    type: 'solid',
    body: '#1A237E',
    accent: '#448AFF',
    label: '#B3D4FF',
    labelShadow: 'rgba(0,0,80,0.5)',
    metalness: 0.65,
    roughness: 0.18,
    swatchBg: 'radial-gradient(circle at 35% 35%, #448AFF, #1A237E)',
    requiresAccount: true,
  },
  {
    id: 'emerald-dragon',
    name: 'Emerald Dragon',
    emoji: '🐉',
    type: 'solid',
    body: '#1B6B3A',
    accent: '#76FF03',
    label: '#C8FFD4',
    labelShadow: 'rgba(0,0,0,0.5)',
    metalness: 0.35,
    roughness: 0.35,
    swatchBg: 'radial-gradient(circle at 35% 35%, #52B788, #1B6B3A)',
    requiresAccount: true,
  },

  // ── Shader Skins (Animated!) ──────────────────────────────────

  {
    id: 'inferno',
    name: 'Inferno',
    emoji: '🔥',
    type: 'shader',
    shaderKey: 'fire',
    body: '#CC2200',
    accent: '#FF9500',
    label: '#FFD700',
    labelShadow: 'rgba(0,0,0,0.7)',
    metalness: 0.4,
    roughness: 0.3,
    swatchBg: 'linear-gradient(0deg, #CC2200, #FF6D00, #FFD700, #FF6D00, #CC2200)',
    swatchAnimation: 'swatch-fire',
    requiresAccount: true,
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    emoji: '🌊',
    type: 'shader',
    shaderKey: 'water',
    body: '#0A5F8A',
    accent: '#00E5FF',
    label: '#B0EFFF',
    labelShadow: 'rgba(0,0,0,0.6)',
    metalness: 0.5,
    roughness: 0.25,
    swatchBg: 'linear-gradient(135deg, #01083A, #0A5F8A, #48B8E8, #0A5F8A, #01083A)',
    swatchAnimation: 'swatch-water',
    requiresAccount: true,
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    emoji: '🌌',
    type: 'shader',
    shaderKey: 'galaxy',
    body: '#1A0033',
    accent: '#A78BFA',
    label: '#E0D0FF',
    labelShadow: 'rgba(100,0,200,0.4)',
    metalness: 0.2,
    roughness: 0.5,
    swatchBg: 'radial-gradient(circle at 30% 40%, #3D1273, #0A0020, #1A0050)',
    swatchAnimation: 'swatch-galaxy',
    requiresAccount: true,
  },
  {
    id: 'holographic',
    name: 'Holographic',
    emoji: '🌈',
    type: 'shader',
    shaderKey: 'holographic',
    body: '#AAAACC',
    accent: '#FFFFFF',
    label: '#FFFFFF',
    labelShadow: 'rgba(0,0,0,0.3)',
    metalness: 0.5,
    roughness: 0.1,
    swatchBg: 'linear-gradient(135deg, #FF0000, #FF8800, #FFFF00, #00FF00, #0088FF, #8800FF, #FF0000)',
    swatchAnimation: 'swatch-holo',
    requiresAccount: true,
  },
  {
    id: 'lightning',
    name: 'Lightning',
    emoji: '⚡',
    type: 'shader',
    shaderKey: 'electric',
    body: '#0A0A30',
    accent: '#4488FF',
    label: '#CCDDFF',
    labelShadow: 'rgba(0,50,200,0.5)',
    metalness: 0.2,
    roughness: 0.5,
    swatchBg: 'radial-gradient(circle at 50% 50%, #4488FF, #0A0A30)',
    swatchAnimation: 'swatch-electric',
    requiresAccount: true,
  },
  {
    id: 'toxic',
    name: 'Toxic',
    emoji: '☢️',
    type: 'shader',
    shaderKey: 'toxic',
    body: '#0A2000',
    accent: '#76FF03',
    label: '#AAFFAA',
    labelShadow: 'rgba(0,80,0,0.5)',
    metalness: 0.2,
    roughness: 0.5,
    swatchBg: 'radial-gradient(circle at 50% 50%, #33FF00, #0A3000)',
    swatchAnimation: 'swatch-toxic',
    requiresAccount: true,
  },
  {
    id: 'marble',
    name: 'Marble',
    emoji: '🏛️',
    type: 'shader',
    shaderKey: 'marble',
    body: '#E8E4E0',
    accent: '#C0B8B0',
    label: '#333344',
    labelShadow: 'rgba(255,255,255,0.5)',
    metalness: 0.1,
    roughness: 0.6,
    swatchBg: 'linear-gradient(135deg, #E8E4E0 25%, #B8A8C0 30%, #E8E4E0 35%, #C8B8A0 60%, #E8E4E0 65%)',
    requiresAccount: true,
  },
  {
    id: 'magma',
    name: 'Magma Cracks',
    emoji: '🌋',
    type: 'shader',
    shaderKey: 'magma',
    body: '#2A0A00',
    accent: '#FF6600',
    label: '#FFD700',
    labelShadow: 'rgba(0,0,0,0.7)',
    metalness: 0.3,
    roughness: 0.4,
    swatchBg: 'radial-gradient(circle at 40% 40%, #FF4400, #2A0A00)',
    swatchAnimation: 'swatch-magma',
    requiresAccount: true,
  },
  {
    id: 'ice-crystal',
    name: 'Ice Crystal',
    emoji: '❄️',
    type: 'shader',
    shaderKey: 'frost',
    body: '#88CCEE',
    accent: '#AAEEFF',
    label: '#FFFFFF',
    labelShadow: 'rgba(0,60,120,0.4)',
    metalness: 0.5,
    roughness: 0.2,
    swatchBg: 'linear-gradient(135deg, #2266AA, #88CCEE, #FFFFFF, #88CCEE, #2266AA)',
    swatchAnimation: 'swatch-frost',
    requiresAccount: true,
  },
  {
    id: 'disco',
    name: 'Disco Ball',
    emoji: '🪩',
    type: 'shader',
    shaderKey: 'disco',
    body: '#CCCCCC',
    accent: '#FFFFFF',
    label: '#111111',
    labelShadow: 'rgba(255,255,255,0.5)',
    metalness: 0.8,
    roughness: 0.1,
    swatchBg: 'conic-gradient(#FF1493, #4488FF, #33FF77, #FFDD00, #FF1493)',
    swatchAnimation: 'swatch-disco',
    requiresAccount: true,
  },
  {
    id: 'blood-moon',
    name: 'Blood Moon',
    emoji: '🌑',
    type: 'shader',
    shaderKey: 'blood-moon',
    body: '#2A0505',
    accent: '#CC0000',
    label: '#FF8888',
    labelShadow: 'rgba(100,0,0,0.6)',
    metalness: 0.3,
    roughness: 0.45,
    swatchBg: 'radial-gradient(circle at 40% 40%, #880000, #1A0000)',
    swatchAnimation: 'swatch-blood',
    requiresAccount: true,
  },

  // ── Emoji Skins (Expressive Face Labels!) ─────────────────────

  {
    id: 'emoji-classic',
    name: 'Mood Dice',
    emoji: '😄',
    type: 'emoji',
    body: '#FFD93D',
    accent: '#FF9500',
    label: '#000000',
    labelShadow: 'rgba(0,0,0,0.3)',
    metalness: 0.15,
    roughness: 0.5,
    swatchBg: 'radial-gradient(circle at 35% 35%, #FFE566, #FFD93D)',
    requiresAccount: true,
  },
  {
    id: 'emoji-spooky',
    name: 'Spooky Dice',
    emoji: '👻',
    type: 'emoji',
    body: '#2D1B4E',
    accent: '#9B59B6',
    label: '#E0D0FF',
    labelShadow: 'rgba(100,0,200,0.4)',
    metalness: 0.2,
    roughness: 0.5,
    swatchBg: 'radial-gradient(circle at 35% 35%, #6C3483, #2D1B4E)',
    requiresAccount: true,
  },
];

export const SKIN_MAP = new Map(DICE_SKINS.map((s) => [s.id, s]));

export function getSkin(id: string): DiceSkin {
  return SKIN_MAP.get(id) ?? DICE_SKINS[0];
}

/**
 * Emoji mapping for emoji-type dice skins.
 * Face expressions change based on the roll value — low = sad, high = happy.
 */
export function getEmojiForFace(faceNumber: number, skinId: string): string {
  if (skinId === 'emoji-spooky') {
    if (faceNumber === 1) return '💀';
    if (faceNumber <= 5) return '👻';
    if (faceNumber <= 10) return '🎃';
    if (faceNumber <= 15) return '🧙';
    if (faceNumber <= 19) return '🔮';
    return '🪄';
  }
  // Default mood dice
  if (faceNumber === 1) return '💀';
  if (faceNumber <= 4) return '😢';
  if (faceNumber <= 7) return '😟';
  if (faceNumber <= 10) return '😐';
  if (faceNumber <= 13) return '🙂';
  if (faceNumber <= 16) return '😄';
  if (faceNumber <= 19) return '🤩';
  return '🥳';
}
