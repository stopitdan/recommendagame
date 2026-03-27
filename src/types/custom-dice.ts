/**
 * Custom Dice Skin types.
 *
 * The config is layered so users can combine features freely:
 * - Base layer: solid color, shader effect, or image
 * - Optional overlay: shader effect stacked on top at reduced opacity
 * - Material & lighting: metalness, roughness, accent light
 * - Labels: numbers, emoji, or hidden
 */

// ─── Config (stored as JSONB in DB) ─────────────────────────────

export interface CustomDiceSkinConfig {
  // ── Base Layer (pick one) ──
  baseType: 'solid' | 'shader' | 'image';
  /** Hex color — body color for solid, tint for image base */
  body: string;
  /** Which shader effect (fire, water, galaxy, etc.) */
  shaderKey?: string;
  /** Custom shader colors instead of defaults */
  shaderColors?: { color1: string; color2: string; color3: string };
  /** Shader animation speed multiplier (0.1-3.0, default 1.0) */
  shaderSpeed?: number;

  // ── Image Layer (when baseType = 'image') ──
  /** How the image is applied to the die */
  imageMode?: 'wrap' | 'per-face' | 'tile';
  /** Image URL for wrap and tile modes */
  wrapImageUrl?: string;
  /** Face 1-20 → URL mapping (sparse, for per-face mode) */
  faceImageUrls?: Record<number, string>;

  // ── Overlay Effect (optional, stacks ON TOP of base) ──
  /** Shader key for overlay (e.g. add fire glow over an image) */
  overlayShaderKey?: string;
  /** 0-1, how strong the overlay is */
  overlayOpacity?: number;

  // ── Material & Lighting ──
  /** Accent/point light color */
  accent: string;
  /** 0-1 material metalness */
  metalness: number;
  /** 0-1 material roughness */
  roughness: number;

  // ── Labels ──
  labelStyle: 'numbers' | 'emoji' | 'hidden';
  /** Number/label color */
  label: string;
  /** Label shadow color */
  labelShadow: string;
  /** Which emoji set (for emoji labelStyle) */
  emojiSet?: 'mood' | 'spooky';
  /** Label size multiplier (0.5-1.5, default 1.0) */
  labelSize?: number;
  /** Font family for number labels */
  labelFont?: string;
  /** Font weight for number labels ('normal', 'bold', '900') */
  labelWeight?: string;
}

// ─── Database row types ─────────────────────────────────────────

export interface CustomDiceSkinRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  config: CustomDiceSkinConfig;
  is_public: boolean;
  vote_count: number;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomDiceSkinInsert {
  user_id: string;
  name: string;
  emoji?: string;
  config: CustomDiceSkinConfig;
  is_public?: boolean;
}

export type CustomDiceSkinUpdate = Partial<Omit<CustomDiceSkinInsert, 'user_id'>>;

export interface CustomDiceVoteRow {
  id: number;
  user_id: string;
  skin_id: string;
}

export interface CustomDiceVoteInsert {
  user_id: string;
  skin_id: string;
}

// ─── Client-facing types ────────────────────────────────────────

/** Skin summary for gallery cards and customizer grid */
export interface CustomDiceSkinSummary {
  id: string;
  name: string;
  emoji: string;
  config: CustomDiceSkinConfig;
  is_public: boolean;
  vote_count: number;
  thumbnail_url: string | null;
  created_at: string;
  /** Present only when the requesting user has voted */
  has_voted?: boolean;
  /** Present in gallery/detail views */
  creator_name?: string;
}
