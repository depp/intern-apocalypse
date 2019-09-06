/* This code is automatically generated. */
import { compileShader, ShaderProgram, ShaderSpec } from './shader';
import { data } from '../lib/global';
import { shaderOffset } from '../lib/loader';

/** Shader program attribute bindings. */
export const enum Attribute {
  Pos = 0,
  Color = 1,
  Normal = 2,
}

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
      attributes: ['aPos', 'aColor', 'aNormal'],
      uniforms: ['Model', 'ViewProjection'],
      object: model,
    },
  ];
}

/** Load all the shaders. */
export function loadShaders(): void {
  compileShader(
    level,
    ['ModelViewProjection'],
    ['aPos', 'aColor'],
    data[shaderOffset + 1],
    data[shaderOffset + 0],
    'level',
  );
  compileShader(
    model,
    ['Model', 'ViewProjection'],
    ['aPos', 'aColor', 'aNormal'],
    data[shaderOffset + 3],
    data[shaderOffset + 2],
    'model',
  );
}
