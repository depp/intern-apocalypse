/**
 * Helper functions for WebGL shader programs.
 * @module src/shader
 */

import { gl } from './global';

/** Compile a WebGL shader. */
export function compileShader(type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!; // FIXME: check?
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      'Failed to compile shader.\n' + gl.getShaderInfoLog(shader),
    );
  }
  return shader;
}

/** Compile and link a WebGL program. */
export function compileProgram(
  attrs: ReadonlyArray<string>,
  vertex: WebGLShader,
  fragment: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram()!; // FIXME: check?
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      'Failed to link shader program.\n' + gl.getProgramInfoLog(program),
    );
  }
  return program;
}
