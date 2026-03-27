/**
 * Tests for dice shader registry.
 */

import { describe, it, expect } from 'vitest';
import { getShaderCode, hasShader } from './dice-shaders';

describe('getShaderCode', () => {
  it('returns vertex and fragment shaders for valid keys', () => {
    const code = getShaderCode('fire');
    expect(code).not.toBeNull();
    expect(code!.vertex).toContain('gl_Position');
    expect(code!.fragment).toContain('gl_FragColor');
  });

  it('returns null for unknown keys', () => {
    expect(getShaderCode('nonexistent')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getShaderCode('')).toBeNull();
  });

  it('all registered shaders have uTime uniform', () => {
    const keys = ['fire', 'water', 'galaxy', 'holographic', 'electric', 'toxic', 'marble', 'magma', 'frost', 'disco', 'blood-moon'];
    for (const key of keys) {
      const code = getShaderCode(key);
      expect(code).not.toBeNull();
      expect(code!.fragment).toContain('uTime');
    }
  });

  it('all registered shaders use vPosition and vNormal', () => {
    const keys = ['fire', 'water', 'galaxy', 'holographic', 'electric', 'toxic', 'marble', 'magma', 'frost', 'disco', 'blood-moon'];
    for (const key of keys) {
      const code = getShaderCode(key);
      expect(code!.vertex).toContain('vPosition');
      expect(code!.vertex).toContain('vNormal');
    }
  });
});

describe('hasShader', () => {
  it('returns true for registered shaders', () => {
    expect(hasShader('fire')).toBe(true);
    expect(hasShader('water')).toBe(true);
    expect(hasShader('galaxy')).toBe(true);
  });

  it('returns false for unknown shaders', () => {
    expect(hasShader('nonexistent')).toBe(false);
    expect(hasShader('')).toBe(false);
  });
});
