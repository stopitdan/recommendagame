/**
 * Tests for custom dice skin utility functions.
 */

import { describe, it, expect } from 'vitest';
import { isCustomSkinId, resolveCustomSkin, generateSwatchBg, validateSkinConfig } from './custom-dice-utils';
import type { CustomDiceSkinConfig } from '@/types/custom-dice';

// ─── Test fixture ───────────────────────────────────────────────

function validConfig(overrides: Partial<CustomDiceSkinConfig> = {}): CustomDiceSkinConfig {
  return {
    baseType: 'solid',
    body: '#5B4FDB',
    accent: '#FF6D3F',
    label: '#FFFFFF',
    labelShadow: 'rgba(0,0,0,0.5)',
    metalness: 0.3,
    roughness: 0.4,
    labelStyle: 'numbers',
    ...overrides,
  };
}

// ─── isCustomSkinId ─────────────────────────────────────────────

describe('isCustomSkinId', () => {
  it('returns true for a valid UUID v4', () => {
    expect(isCustomSkinId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('returns true for uppercase UUID', () => {
    expect(isCustomSkinId('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('returns false for built-in skin slugs', () => {
    expect(isCustomSkinId('classic-purple')).toBe(false);
    expect(isCustomSkinId('inferno')).toBe(false);
    expect(isCustomSkinId('emoji-classic')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isCustomSkinId('')).toBe(false);
  });

  it('returns false for partial UUID', () => {
    expect(isCustomSkinId('550e8400-e29b-41d4')).toBe(false);
  });
});

// ─── resolveCustomSkin ──────────────────────────────────────────

describe('resolveCustomSkin', () => {
  it('resolves solid config to solid DiceSkin', () => {
    const result = resolveCustomSkin('uuid-1', 'My Dice', '🎲', validConfig());
    expect(result.type).toBe('solid');
    expect(result.body).toBe('#5B4FDB');
    expect(result.id).toBe('uuid-1');
    expect(result.name).toBe('My Dice');
    expect(result.requiresAccount).toBe(true);
  });

  it('resolves shader config to shader DiceSkin', () => {
    const result = resolveCustomSkin('uuid-2', 'Fire Dice', '🔥', validConfig({
      baseType: 'shader',
      shaderKey: 'fire',
    }));
    expect(result.type).toBe('shader');
    expect(result.shaderKey).toBe('fire');
  });

  it('resolves emoji labelStyle to emoji type', () => {
    const result = resolveCustomSkin('uuid-3', 'Emoji Dice', '😄', validConfig({
      labelStyle: 'emoji',
    }));
    expect(result.type).toBe('emoji');
  });

  it('falls back to solid for invalid shader key', () => {
    const result = resolveCustomSkin('uuid-4', 'Bad', '🎲', validConfig({
      baseType: 'shader',
      shaderKey: 'nonexistent',
    }));
    expect(result.type).toBe('solid');
  });

  it('includes customConfig in result', () => {
    const config = validConfig();
    const result = resolveCustomSkin('uuid-5', 'Test', '🎲', config);
    expect(result.customConfig).toEqual(config);
  });
});

// ─── generateSwatchBg ───────────────────────────────────────────

describe('generateSwatchBg', () => {
  it('generates radial gradient for solid config', () => {
    const bg = generateSwatchBg(validConfig());
    expect(bg).toContain('radial-gradient');
    expect(bg).toContain('#5B4FDB');
  });

  it('generates linear gradient for shader config', () => {
    const bg = generateSwatchBg(validConfig({
      baseType: 'shader',
      shaderKey: 'fire',
    }));
    expect(bg).toContain('linear-gradient');
  });

  it('uses custom shader colors when provided', () => {
    const bg = generateSwatchBg(validConfig({
      baseType: 'shader',
      shaderKey: 'fire',
      shaderColors: { color1: '#FF0000', color2: '#00FF00', color3: '#0000FF' },
    }));
    expect(bg).toContain('#FF0000');
    expect(bg).toContain('#00FF00');
  });

  it('generates radial gradient for image config', () => {
    const bg = generateSwatchBg(validConfig({ baseType: 'image' }));
    expect(bg).toContain('radial-gradient');
  });
});

// ─── validateSkinConfig ─────────────────────────────────────────

describe('validateSkinConfig', () => {
  it('returns empty array for valid config', () => {
    expect(validateSkinConfig(validConfig())).toEqual([]);
  });

  it('rejects null config', () => {
    const errors = validateSkinConfig(null);
    expect(errors).toContain('Config must be an object');
  });

  it('rejects non-object config', () => {
    expect(validateSkinConfig('string')).toContain('Config must be an object');
    expect(validateSkinConfig(42)).toContain('Config must be an object');
  });

  it('validates baseType', () => {
    const errors = validateSkinConfig({ ...validConfig(), baseType: 'invalid' });
    expect(errors.some((e) => e.includes('baseType'))).toBe(true);
  });

  it('validates color fields', () => {
    const errors = validateSkinConfig({ ...validConfig(), body: 'not-a-color' });
    expect(errors.some((e) => e.includes('body'))).toBe(true);
  });

  it('accepts rgba colors', () => {
    const errors = validateSkinConfig(validConfig({ labelShadow: 'rgba(0,0,0,0.5)' }));
    expect(errors).toEqual([]);
  });

  it('validates metalness range', () => {
    const errors = validateSkinConfig({ ...validConfig(), metalness: 1.5 });
    expect(errors.some((e) => e.includes('metalness'))).toBe(true);
  });

  it('validates roughness range', () => {
    const errors = validateSkinConfig({ ...validConfig(), roughness: -0.1 });
    expect(errors.some((e) => e.includes('roughness'))).toBe(true);
  });

  it('validates labelStyle', () => {
    const errors = validateSkinConfig({ ...validConfig(), labelStyle: 'fancy' });
    expect(errors.some((e) => e.includes('labelStyle'))).toBe(true);
  });

  it('validates shaderKey when baseType is shader', () => {
    const errors = validateSkinConfig({
      ...validConfig(),
      baseType: 'shader',
      shaderKey: 'nonexistent',
    });
    expect(errors.some((e) => e.includes('shaderKey'))).toBe(true);
  });

  it('accepts valid shader config', () => {
    const errors = validateSkinConfig({
      ...validConfig(),
      baseType: 'shader',
      shaderKey: 'fire',
    });
    expect(errors).toEqual([]);
  });

  it('validates overlayShaderKey', () => {
    const errors = validateSkinConfig({
      ...validConfig(),
      overlayShaderKey: 'bad-key',
    });
    expect(errors.some((e) => e.includes('overlayShaderKey'))).toBe(true);
  });

  it('validates overlayOpacity range', () => {
    const errors = validateSkinConfig({
      ...validConfig(),
      overlayShaderKey: 'fire',
      overlayOpacity: 2.0,
    });
    expect(errors.some((e) => e.includes('overlayOpacity'))).toBe(true);
  });

  it('validates imageMode when baseType is image', () => {
    const errors = validateSkinConfig({
      ...validConfig(),
      baseType: 'image',
      imageMode: 'stretch',
    });
    expect(errors.some((e) => e.includes('imageMode'))).toBe(true);
  });

  it('validates emojiSet', () => {
    const errors = validateSkinConfig({
      ...validConfig(),
      emojiSet: 'alien',
    });
    expect(errors.some((e) => e.includes('emojiSet'))).toBe(true);
  });

  it('collects multiple errors at once', () => {
    const errors = validateSkinConfig({
      baseType: 'invalid',
      body: 'bad',
      accent: 'bad',
      label: 'bad',
      labelShadow: 'bad',
      metalness: 5,
      roughness: -1,
      labelStyle: 'bad',
    });
    expect(errors.length).toBeGreaterThan(5);
  });
});
