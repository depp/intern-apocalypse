/* This code is automatically generated. */
import { compileShader, ShaderProgram, ShaderSpec } from './shader';

export interface LevelProgram extends ShaderProgram {
  ModelViewProjection: WebGLUniformLocation | null;
}
export const level = compileShader(['ModelViewProjection']) as LevelProgram;

export interface ModelProgram extends ShaderProgram {
  Model: WebGLUniformLocation | null;
  ViewProjection: WebGLUniformLocation | null;
}
export const model = compileShader(['Model', 'ViewProjection']) as ModelProgram;

export function getShaderSpecs(): ShaderSpec[] {
  return [
    {
      name: 'level',
      vertex: 'level.vert',
      fragment: 'level.frag',
      attributes: ['aPos', 'aColor', 'aNormal'],
      uniforms: ['ModelViewProjection'],
      object: level,
    },
    {
      name: 'model',
      vertex: 'model.vert',
      fragment: 'model.frag',
      attributes: ['aPos', 'aColor'],
      uniforms: ['Model', 'ViewProjection'],
      object: model,
    },
  ];
}
