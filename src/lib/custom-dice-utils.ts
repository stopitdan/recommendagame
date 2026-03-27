/**
 * Utility functions for custom dice skins.
 */

import type { CustomDiceSkinConfig } from '@/types/custom-dice';
import type { DiceSkin } from '@/lib/dice-skins';
import { hasShader, SHADER_DEFAULTS } from '@/lib/dice-shaders';

/** UUID v4 regex for identifying custom skin IDs */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true if the ID looks like a custom skin UUID (vs a built-in slug).
 */
export function isCustomSkinId(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Resolves a CustomDiceSkinConfig into a DiceSkin-compatible object
 * that PhysicsDice can render. The returned object has all the fields
 * PhysicsDice needs, plus the custom config for advanced rendering.
 */
export function resolveCustomSkin(
  id: string,
  name: string,
  emoji: string,
  config: CustomDiceSkinConfig,
): DiceSkin & { customConfig: CustomDiceSkinConfig } {
  // Map baseType to DiceSkin type
  let type: DiceSkin['type'] = 'solid';
  let shaderKey: string | undefined;

  if (config.baseType === 'shader' && config.shaderKey && hasShader(config.shaderKey)) {
    type = 'shader';
    shaderKey = config.shaderKey;
  } else if (config.labelStyle === 'emoji') {
    type = 'emoji';
  }

  return {
    id,
    name,
    emoji,
    type,
    body: config.body,
    accent: config.accent,
    label: config.label,
    labelShadow: config.labelShadow,
    metalness: config.metalness,
    roughness: config.roughness,
    shaderKey,
    swatchBg: generateSwatchBg(config),
    requiresAccount: true,
    customConfig: config,
  };
}

/**
 * Generates a CSS background string for the customizer swatch
 * based on the skin config.
 */
export function generateSwatchBg(config: CustomDiceSkinConfig): string {
  if (config.baseType === 'shader' && config.shaderKey) {
    const defaults = SHADER_DEFAULTS[config.shaderKey];
    const c1 = config.shaderColors?.color1 ?? defaults?.color1 ?? config.body;
    const c2 = config.shaderColors?.color2 ?? defaults?.color2 ?? config.body;
    return `linear-gradient(135deg, ${c1}, ${c2})`;
  }

  if (config.baseType === 'image') {
    // Show body color with a small image icon pattern
    return `radial-gradient(circle at 35% 35%, ${config.body}88, ${config.body})`;
  }

  // Solid
  return `radial-gradient(circle at 35% 35%, ${config.body}CC, ${config.body})`;
}

/** Hex color regex: #RGB, #RRGGBB, or #RRGGBBAA */
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** rgba() color pattern */
const RGBA_REGEX = /^rgba?\(\s*\d+/i;

function isValidColor(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return HEX_COLOR_REGEX.test(value) || RGBA_REGEX.test(value);
}

/**
 * Validates a CustomDiceSkinConfig, returning an array of error messages.
 * Empty array = valid.
 */
export function validateSkinConfig(config: unknown): string[] {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return ['Config must be an object'];
  }

  const c = config as Record<string, unknown>;

  // Base type
  if (!['solid', 'shader', 'image'].includes(c.baseType as string)) {
    errors.push('baseType must be "solid", "shader", or "image"');
  }

  // Required color fields
  for (const field of ['body', 'accent', 'label', 'labelShadow'] as const) {
    if (!isValidColor(c[field])) {
      errors.push(`${field} must be a valid color string`);
    }
  }

  // Material values
  if (typeof c.metalness !== 'number' || c.metalness < 0 || c.metalness > 1) {
    errors.push('metalness must be a number between 0 and 1');
  }
  if (typeof c.roughness !== 'number' || c.roughness < 0 || c.roughness > 1) {
    errors.push('roughness must be a number between 0 and 1');
  }

  // Label style
  if (!['numbers', 'emoji', 'hidden'].includes(c.labelStyle as string)) {
    errors.push('labelStyle must be "numbers", "emoji", or "hidden"');
  }

  // Shader validation
  if (c.baseType === 'shader') {
    if (typeof c.shaderKey !== 'string' || !hasShader(c.shaderKey)) {
      errors.push('shaderKey must be a valid shader name');
    }
  }

  // Overlay validation
  if (c.overlayShaderKey !== undefined) {
    if (typeof c.overlayShaderKey !== 'string' || !hasShader(c.overlayShaderKey)) {
      errors.push('overlayShaderKey must be a valid shader name');
    }
    if (c.overlayOpacity !== undefined) {
      if (typeof c.overlayOpacity !== 'number' || c.overlayOpacity < 0 || c.overlayOpacity > 1) {
        errors.push('overlayOpacity must be a number between 0 and 1');
      }
    }
  }

  // Image mode validation
  if (c.baseType === 'image') {
    if (c.imageMode !== undefined && !['wrap', 'per-face', 'tile'].includes(c.imageMode as string)) {
      errors.push('imageMode must be "wrap", "per-face", or "tile"');
    }
  }

  // Emoji set validation
  if (c.emojiSet !== undefined && !['mood', 'spooky'].includes(c.emojiSet as string)) {
    errors.push('emojiSet must be "mood" or "spooky"');
  }

  return errors;
}
