/**
 * Tests for dice skin presets.
 */

import { describe, it, expect } from 'vitest';
import {
  DICE_SKINS,
  DEFAULT_SKIN_ID,
  getSkin,
  SKIN_MAP,
  getEmojiForFace,
} from './dice-skins';
import { hasShader } from './dice-shaders';

describe('DICE_SKINS', () => {
  it('contains at least 10 skins', () => {
    expect(DICE_SKINS.length).toBeGreaterThanOrEqual(10);
  });

  it('has unique IDs', () => {
    const ids = DICE_SKINS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has the default skin in the list', () => {
    const defaultSkin = DICE_SKINS.find((s) => s.id === DEFAULT_SKIN_ID);
    expect(defaultSkin).toBeDefined();
  });

  it('default skin does not require an account', () => {
    const defaultSkin = getSkin(DEFAULT_SKIN_ID);
    expect(defaultSkin.requiresAccount).toBe(false);
  });

  it('default skin is type solid', () => {
    const defaultSkin = getSkin(DEFAULT_SKIN_ID);
    expect(defaultSkin.type).toBe('solid');
  });

  it('every skin has valid hex color for body and accent', () => {
    for (const skin of DICE_SKINS) {
      expect(skin.body).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(skin.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('every skin has metalness and roughness in valid range', () => {
    for (const skin of DICE_SKINS) {
      expect(skin.metalness).toBeGreaterThanOrEqual(0);
      expect(skin.metalness).toBeLessThanOrEqual(1);
      expect(skin.roughness).toBeGreaterThanOrEqual(0);
      expect(skin.roughness).toBeLessThanOrEqual(1);
    }
  });

  it('every skin has a non-empty swatchBg', () => {
    for (const skin of DICE_SKINS) {
      expect(skin.swatchBg.length).toBeGreaterThan(0);
    }
  });

  it('has at least one skin of each type', () => {
    const types = new Set(DICE_SKINS.map((s) => s.type));
    expect(types.has('solid')).toBe(true);
    expect(types.has('shader')).toBe(true);
    expect(types.has('emoji')).toBe(true);
  });

  it('shader skins reference valid shader keys', () => {
    const shaderSkins = DICE_SKINS.filter((s) => s.type === 'shader');
    for (const skin of shaderSkins) {
      expect(skin.shaderKey).toBeDefined();
      expect(hasShader(skin.shaderKey!)).toBe(true);
    }
  });
});

describe('getSkin', () => {
  it('returns matching skin by ID', () => {
    const skin = getSkin('inferno');
    expect(skin.name).toBe('Inferno');
    expect(skin.type).toBe('shader');
  });

  it('returns default skin for unknown ID', () => {
    const skin = getSkin('nonexistent-skin');
    expect(skin.id).toBe(DEFAULT_SKIN_ID);
  });

  it('returns default skin for empty string', () => {
    const skin = getSkin('');
    expect(skin.id).toBe(DEFAULT_SKIN_ID);
  });
});

describe('SKIN_MAP', () => {
  it('contains all skins', () => {
    expect(SKIN_MAP.size).toBe(DICE_SKINS.length);
  });

  it('maps IDs to correct skins', () => {
    for (const skin of DICE_SKINS) {
      expect(SKIN_MAP.get(skin.id)).toBe(skin);
    }
  });
});

describe('getEmojiForFace', () => {
  it('returns skull for face 1 on mood dice', () => {
    expect(getEmojiForFace(1, 'emoji-classic')).toBe('💀');
  });

  it('returns party emoji for face 20 on mood dice', () => {
    expect(getEmojiForFace(20, 'emoji-classic')).toBe('🥳');
  });

  it('returns sad emoji for low numbers', () => {
    expect(getEmojiForFace(3, 'emoji-classic')).toBe('😢');
  });

  it('returns happy emoji for high numbers', () => {
    expect(getEmojiForFace(18, 'emoji-classic')).toBe('🤩');
  });

  it('returns different emojis for spooky skin', () => {
    expect(getEmojiForFace(1, 'emoji-spooky')).toBe('💀');
    expect(getEmojiForFace(8, 'emoji-spooky')).toBe('🎃');
    expect(getEmojiForFace(20, 'emoji-spooky')).toBe('🪄');
  });
});
