/* This code is automatically generated. */
import { compileShader, ShaderProgram, ShaderSpec } from './shader';
import { bundledData } from '../lib/global';
import { shaderOffset } from '../lib/loader';

export interface UiProgram extends ShaderProgram {
  ModelViewProjection: WebGLUniformLocation | null;
  Texture: WebGLUniformLocation | null;
}
export const uiShader = {} as UiProgram;
export const enum UiAttrib {
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
      name: 'ui',
      vertex: 'ui.vert',
      fragment: 'ui.frag',
      attributes: ['aPos', 'aColor', 'aTexCoord'],
      uniforms: ['ModelViewProjection', 'Texture'],
      object: uiShader,
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
    uiShader,
    ['ModelViewProjection', 'Texture'],
    ['aPos', 'aColor', 'aTexCoord'],
    bundledData[shaderOffset + 5],
    bundledData[shaderOffset + 4],
    'ui',
  );
  compileShader(
    levelShader,
    ['ModelViewProjection'],
    ['aPos', 'aColor'],
    bundledData[shaderOffset + 1],
    bundledData[shaderOffset + 0],
    'level',
  );
  compileShader(
    modelShader,
    ['Model', 'ViewProjection'],
    ['aPos', 'aColor', '', 'aNormal'],
    bundledData[shaderOffset + 3],
    bundledData[shaderOffset + 2],
    'model',
  );
}
