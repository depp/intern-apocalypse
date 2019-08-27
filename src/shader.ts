/**
 * Helper functions for WebGL shader programs.
 */

import { gl } from './global';
import { isDebug, AssertionError } from './debug';

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
  /** List of attributes to use, in order. */
  readonly attributes: readonly string[];
  /** List of uniforms. */
  readonly uniforms: readonly string[];
  /** Object containing the program and uniforms locations. */
  readonly object: ShaderProgram;
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
export function compileShader(uniforms: StringArray): any;
export function compileShader(
  uniforms: StringArray,
  attribs: StringArray,
  vertex: string,
  fragment: string,
): any;
export function compileShader(
  uniforms: StringArray,
  attribs?: StringArray | undefined,
  vertex?: string | undefined,
  fragment?: string | undefined,
): any {
  // Stub object for debug builds.
  if (isDebug && attribs == null) {
    const obj: any = { program: null };
    for (const name of uniforms) {
      obj[name] = null;
    }
    return obj;
  }
  if (attribs == null) {
    throw new AssertionError('null attribs');
  }

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
      console.error(
        'Failed to compile shader.\n' + gl.getShaderInfoLog(shader),
      );
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  for (let i = 0; i < attribs.length; i++) {
    gl.bindAttribLocation(program, i, attribs[i]);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
      'Failed to link shader program.\n' + gl.getProgramInfoLog(program),
    );
  }

  if (isDebug) {
    // Print warnings for extra attributes.
    const anames = new Set<string>(attribs);
    const acount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < acount; i++) {
      const attrib = gl.getActiveAttrib(program, i);
      if (attrib) {
        if (!anames.has(attrib.name)) {
          console.warn(`unused attribute: ${JSON.stringify(attrib.name)}`);
        }
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
          console.warn(`unused uniform: ${JSON.stringify(uniform.name)}`);
        }
      }
    }
  }

  const obj: any = { program };
  for (const name of uniforms) {
    obj[name] =
      gl.getUniformLocation(program, name) ||
      gl.getUniformLocation(program, name + '[0]');
  }
  return obj;
}
