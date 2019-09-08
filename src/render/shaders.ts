/* This code is automatically generated. */
import { compileShader, ShaderProgram, ShaderSpec } from './shader';
import { bundledData } from '../lib/global';
import { shaderOffset } from '../lib/loader';

export interface FlatProgram extends ShaderProgram {
  Model: WebGLUniformLocation | null;
  Texture: WebGLUniformLocation | null;
  ViewProjection: WebGLUniformLocation | null;
}
export const flatShader = {} as FlatProgram;
export const enum FlatAttrib {
  Pos = 0,
  Color = 1,
  TexCoord = 2,
}

export interface LevelProgram extends ShaderProgram {
  ModelViewProjection: WebGLUniformLocation | null;
}
export const levelShader = {} as LevelProgram;
export const enum LevelAttrib {
  Pos = 0,
  Color = 1,
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

/** Get specs for all shader programs. */
export function getShaderSpecs(): ShaderSpec[] {
  return [
    {
      name: 'flat',
      vertex: 'model.vert',
      fragment: 'flat.frag',
      attributes: ['aPos', 'aColor', 'aTexCoord'],
      uniforms: ['Model', 'Texture', 'ViewProjection'],
      object: flatShader,
    },
    {
      name: 'level',
      vertex: 'level.vert',
      fragment: 'level.frag',
      attributes: ['aPos', 'aColor'],
      uniforms: ['ModelViewProjection'],
      object: levelShader,
    },
    {
      name: 'model',
      vertex: 'model.vert',
      fragment: 'model.frag',
      attributes: ['aPos', 'aColor', '', 'aNormal'],
      uniforms: ['Model', 'ViewProjection'],
      object: modelShader,
    },
  ];
}

/** Load all the shaders. */
export function loadShaders(): void {
  compileShader(
    flatShader,
    ['Model', 'Texture', 'ViewProjection'],
    ['aPos', 'aColor', 'aTexCoord'],
    bundledData[shaderOffset + 4],
    bundledData[shaderOffset + 0],
    'flat',
  );
  compileShader(
    levelShader,
    ['ModelViewProjection'],
    ['aPos', 'aColor'],
    bundledData[shaderOffset + 2],
    bundledData[shaderOffset + 1],
    'level',
  );
  compileShader(
    modelShader,
    ['Model', 'ViewProjection'],
    ['aPos', 'aColor', '', 'aNormal'],
    bundledData[shaderOffset + 4],
    bundledData[shaderOffset + 3],
    'model',
  );
}
