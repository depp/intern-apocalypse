/**
 * Helper functions for WebGL shader programs.
 */

import { gl } from '../lib/global';
import { isDebug, AssertionError } from '../debug/debug';

/**
 * Base interface for shader programs.
 *
 * Shader programs extend this by adding uniforms.
 */
export interface ShaderProgram {
  program: WebGLProgram | null;
}

/**
 * Shader specification for dynamic loading.
 */
export interface ShaderSpec {
  /** The program name. */
  readonly name: string;
  /** The vertex shader filename. */
  readonly vertex: string;
  /** The fragment shader filename. */
  readonly fragment: string;
  /** List of attributes to use, in order. An empty string is an empty slot. */
  readonly attributes: readonly string[];
  /** List of uniforms. */
  readonly uniforms: readonly string[];
  /** Object containing the program and uniforms locations. */
  readonly object: ShaderProgram & any;
}

// Note: The attribs and uniforms are ArrayLike<string> & Iterable<string>
// because this way we can use either a string or an array of strings.
type StringArray = ArrayLike<string> & Iterable<string>;

/** Exception type for shader compilation errors. */
export class ShaderError extends Error {
  infoLog: string | null;
  constructor(message: string, infoLog: string | null = null) {
    super(message);
    this.infoLog = infoLog;
  }
}

/** Compile and link a WebGL shader program. */
export function compileShader(
  object: ShaderProgram & any,
  uniforms: StringArray,
  attribs: StringArray,
  vertex: string,
  fragment: string,
  programName?: string | undefined,
): void {
  // Compile and link the shader.
  const program = gl.createProgram();
  if (!program) {
    throw new AssertionError('createProgram returned null');
  }
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as [number, string][]) {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new AssertionError('createShader returned null');
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      if (isDebug) {
        console.error(
          `${programName}: Failed to compile shader.\n` +
            gl.getShaderInfoLog(shader),
        );
        gl.deleteShader(shader);
        gl.deleteProgram(program);
        return;
      }
      throw new Error('shader error');
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  for (let i = 0; i < attribs.length; i++) {
    if (attribs[i].trim() != '') {
      gl.bindAttribLocation(program, i, attribs[i]);
    }
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (isDebug) {
      console.error(
        `${programName}: Failed to link shader program.\n` +
          gl.getProgramInfoLog(program),
      );
      gl.deleteProgram(program);
      return;
    }
    throw new Error('shader error');
  }

  if (isDebug) {
    // Print warnings for extra attributes.
    const anames = new Set<string>(attribs);
    anames.delete('');
    const aexist = new Set<string>();
    const acount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < acount; i++) {
      const attrib = gl.getActiveAttrib(program, i);
      if (attrib) {
        aexist.add(attrib.name);
      }
    }
    for (const name of anames) {
      if (!aexist.has(name)) {
        console.warn(
          `${programName}: Unknown attribute: ` + JSON.stringify(name),
        );
      }
    }
    // Print warnings for extra uniforms.
    const unames = new Set<string>(uniforms);
    const ucount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < ucount; i++) {
      const uniform = gl.getActiveUniform(program, i);
      if (uniform) {
        const name = uniform.name.split('[')[0];
        if (!unames.has(name)) {
          console.warn(
            `${programName}: Unused uniform: ` + JSON.stringify(uniform.name),
          );
        }
      }
    }
  }

  if (isDebug) {
    if (object.program != null) {
      gl.deleteProgram(object.program);
    }
  }
  object.program = program;
  for (const name of uniforms) {
    object[name] =
      gl.getUniformLocation(program, name) ||
      gl.getUniformLocation(program, name + '[0]');
  }
}
