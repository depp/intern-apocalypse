/* This code is automatically generated. */
import { compileShader, ShaderProgram, ShaderSpec } from './shader';
import { bundledData } from '../lib/global';
import { shaderOffset } from '../lib/loader';

/** Shader program attribute bindings. */
export const enum Attribute {
  Pos = 0,
  Color = 1,
  TexCoord = 2,
  Normal = 3,
}

export interface FlatProgram extends ShaderProgram {
  Model: WebGLUniformLocation | null;
  Texture: WebGLUniformLocation | null;
  ViewProjection: WebGLUniformLocation | null;
}
export const flat = {} as FlatProgram;
export interface LevelProgram extends ShaderProgram {
  ModelViewProjection: WebGLUniformLocation | null;
}
export const level = {} as LevelProgram;
export interface ModelProgram extends ShaderProgram {
  Model: WebGLUniformLocation | null;
  ViewProjection: WebGLUniformLocation | null;
}
export const model = {} as ModelProgram;

/** Get specs for all shader programs. */
export function getShaderSpecs(): ShaderSpec[] {
  return [
    {
      name: 'flat',
      vertex: 'model.vert',
      fragment: 'flat.frag',
      attributes: ['aPos', 'aColor', 'aTexCoord'],
      uniforms: ['Model', 'Texture', 'ViewProjection'],
      object: flat,
    },
    {
      name: 'level',
      vertex: 'level.vert',
      fragment: 'level.frag',
      attributes: ['aPos', 'aColor'],
      uniforms: ['ModelViewProjection'],
      object: level,
    },
    {
      name: 'model',
      vertex: 'model.vert',
      fragment: 'model.frag',
      attributes: ['aPos', 'aColor', '', 'aNormal'],
      uniforms: ['Model', 'ViewProjection'],
      object: model,
    },
  ];
}

/** Load all the shaders. */
export function loadShaders(): void {
  compileShader(
    flat,
    ['Model', 'Texture', 'ViewProjection'],
    ['aPos', 'aColor', 'aTexCoord'],
    bundledData[shaderOffset + 4],
    bundledData[shaderOffset + 0],
    'flat',
  );
  compileShader(
    level,
    ['ModelViewProjection'],
    ['aPos', 'aColor'],
    bundledData[shaderOffset + 2],
    bundledData[shaderOffset + 1],
    'level',
  );
  compileShader(
    model,
    ['Model', 'ViewProjection'],
    ['aPos', 'aColor', '', 'aNormal'],
    bundledData[shaderOffset + 4],
    bundledData[shaderOffset + 3],
    'model',
  );
}
