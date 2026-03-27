/**
 * Tests for dice shader registry.
 */

import { describe, it, expect } from 'vitest';
import { getShaderCode, hasShader, getParameterizedShaderCode, SHADER_DEFAULTS, SHADER_KEYS } from './dice-shaders';

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

describe('SHADER_DEFAULTS', () => {
  it('has defaults for all registered shaders', () => {
    for (const key of SHADER_KEYS) {
      expect(SHADER_DEFAULTS[key]).toBeDefined();
      expect(SHADER_DEFAULTS[key].color1).toMatch(/^#/);
      expect(SHADER_DEFAULTS[key].color2).toMatch(/^#/);
      expect(SHADER_DEFAULTS[key].color3).toMatch(/^#/);
    }
  });
});

describe('SHADER_KEYS', () => {
  it('contains all 11 shader keys', () => {
    expect(SHADER_KEYS).toHaveLength(11);
    expect(SHADER_KEYS).toContain('fire');
    expect(SHADER_KEYS).toContain('blood-moon');
  });
});

describe('getParameterizedShaderCode', () => {
  it('returns code with color uniforms in fragment shader', () => {
    const code = getParameterizedShaderCode('fire');
    expect(code).not.toBeNull();
    expect(code!.fragment).toContain('uniform vec3 uColor1');
    expect(code!.fragment).toContain('uniform vec3 uColor2');
    expect(code!.fragment).toContain('uniform vec3 uColor3');
  });

  it('returns code with color uniforms in vertex shader', () => {
    const code = getParameterizedShaderCode('water');
    expect(code).not.toBeNull();
    expect(code!.vertex).toContain('uniform vec3 uColor1');
  });

  it('returns null for unknown keys', () => {
    expect(getParameterizedShaderCode('nonexistent')).toBeNull();
  });

  it('preserves original shader functionality', () => {
    const code = getParameterizedShaderCode('galaxy');
    expect(code!.fragment).toContain('uTime');
    expect(code!.fragment).toContain('gl_FragColor');
  });
});
