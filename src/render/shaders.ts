/* This code is automatically generated. */
import { compileShader, ShaderProgram, ShaderSpec } from './shader';
import { shaderOffset } from '../lib/loader';

export interface UiProgram extends ShaderProgram {
  Scale: WebGLUniformLocation | null;
  Texture: WebGLUniformLocation | null;
}
export const uiShader = {} as UiProgram;
export const enum UiAttrib {
  Pos = 0,
  Color = 1,
  TexCoord = 2,
}

export interface ModelProgram extends ShaderProgram {
  Model: WebGLUniformLocation | null;
  ViewProjection: WebGLUniformLocation | null;
}
export const modelShader = {} as ModelProgram;
export const enum ModelAttrib {
  Pos = 0,
  Color = 1,
  Normal = 3,
}

export interface ParticlesProgram extends ShaderProgram {
  ColorRate: WebGLUniformLocation | null;
  Colors: WebGLUniformLocation | null;
  Gravity: WebGLUniformLocation | null;
  Model: WebGLUniformLocation | null;
  Time: WebGLUniformLocation | null;
  TimeDelay: WebGLUniformLocation | null;
  Velocity: WebGLUniformLocation | null;
  ViewProjection: WebGLUniformLocation | null;
}
export const particlesShader = {} as ParticlesProgram;
export const enum ParticlesAttrib {
  Pos = 0,
  Random = 1,
  Color = 2,
}

/** Get specs for all shader programs. */
export function getShaderSpecs(): ShaderSpec[] {
  return [
    {
      name: 'ui',
      vertex: 'ui.vert',
      fragment: 'ui.frag',
      attributes: ['aPos', 'aColor', 'aTexCoord'],
      uniforms: ['Scale', 'Texture'],
      object: uiShader,
    },
    {
      name: 'model',
      vertex: 'model.vert',
      fragment: 'model.frag',
      attributes: ['aPos', 'aColor', '', 'aNormal'],
      uniforms: ['Model', 'ViewProjection'],
      object: modelShader,
    },
    {
      name: 'particles',
      vertex: 'particles.vert',
      fragment: 'particles.frag',
      attributes: ['aPos', 'aRandom', 'aColor'],
      uniforms: [
        'ColorRate',
        'Colors',
        'Gravity',
        'Model',
        'Time',
        'TimeDelay',
        'Velocity',
        'ViewProjection',
      ],
      object: particlesShader,
    },
  ];
}

/** Load all the shaders. */
export function loadShaders(data: readonly string[]): void {
  compileShader(
    uiShader,
    ['Scale', 'Texture'],
    ['aPos', 'aColor', 'aTexCoord'],
    data[shaderOffset + 5],
    data[shaderOffset + 4],
    'ui',
  );
  compileShader(
    modelShader,
    ['Model', 'ViewProjection'],
    ['aPos', 'aColor', '', 'aNormal'],
    data[shaderOffset + 1],
    data[shaderOffset + 0],
    'model',
  );
  compileShader(
    particlesShader,
    [
      'ColorRate',
      'Colors',
      'Gravity',
      'Model',
      'Time',
      'TimeDelay',
      'Velocity',
      'ViewProjection',
    ],
    ['aPos', 'aRandom', 'aColor'],
    data[shaderOffset + 3],
    data[shaderOffset + 2],
    'particles',
  );
}
