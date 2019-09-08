import * as fs from 'fs';

import { Names, convertName } from './util';
import { BuildError } from './action';
import { Shader, Declarations } from './shader.syntax';
import { AssertionError } from '../src/debug/debug';

/** Information about an attribute binding. */
export interface Attribute {
  /** Name as it appears in shader. */
  glName: string;
  /** Enumeration name of the slot. */
  enumName: string;
}

/** A shader program specification. */
export interface Program {
  /** Name of the program. */
  name: Names;
  /** Filename of the vertex shader. */
  vertex: string;
  /** Filename of the fragment shader. */
  fragment: string;
  /** List of attributes to use, in order. */
  attributes: readonly (Attribute | null)[];
  /** List of uniforms. */
  uniforms: readonly string[];
}

/**
 * Read shader programs metadata.
 *
 * Does not fill in uniforms.
 */
async function readPrograms(filename: string): Promise<Program[]> {
  const data = await fs.promises.readFile(filename, 'utf8');
  const obj = JSON.parse(data);
  if (typeof obj != 'object' || !Array.isArray(obj)) {
    throw new Error('file is not an array');
  }
  const result: Program[] = [];
  const attrs = new Set(['name', 'vertex', 'fragment', 'attributes']);
  for (const item of obj) {
    if (typeof item != 'object' || Array.isArray(item)) {
      throw new Error('entry is not an object');
    }
    for (const key of Object.keys(item)) {
      if (!attrs.has(key)) {
        throw new Error(`entry has unknown attribute ${JSON.stringify(key)}`);
      }
    }
    for (const key in attrs) {
      if (!Object.prototype.hasOwnProperty.call(item, key)) {
        throw new Error(`missing key ${JSON.stringify(key)}`);
      }
    }
    const { name, vertex, fragment, attributes } = item;
    if (typeof name != 'string') {
      throw new Error('invalid name value');
    }
    if (typeof vertex != 'string') {
      throw new Error('invalid vertex value');
    }
    if (typeof fragment != 'string') {
      throw new Error('invalid fragment value');
    }
    if (typeof attributes != 'object' || !Array.isArray(attributes)) {
      throw new Error('invalid attributes value');
    }
    let bindings: (Attribute | null)[] = [];
    for (const attr of attributes) {
      if (typeof attr == 'string') {
        if (!/^a[A-Z][A-Za-z0-9]*$/.test(attr)) {
          throw new BuildError(
            `invalid attribute name ${JSON.stringify(attr)}`,
          );
        }
        bindings.push({
          glName: attr,
          enumName: attr.substring(1),
        });
      } else if (attr === null) {
        bindings.push(null);
      } else {
        throw new Error('invalid attribute');
      }
    }
    result.push({
      name: convertName(name),
      vertex,
      fragment,
      attributes: bindings,
      uniforms: [],
    });
  }
  return result;
}

/**
 * Shader data and metadata.
 */
export interface ShaderInfo {
  filename: string;
  /** The shader source code. */
  source: string;
  /** The data index where the shader source is stored. */
  index: number;
  /** Parsed shader. */
  shader: Shader;
  /** Shader variable declarations. */
  declarations: Declarations;
}

/** Load a single shader. */
async function readShader(
  filename: string,
  index: number,
): Promise<ShaderInfo> {
  const filepath = 'shader/' + filename;
  const source = await fs.promises.readFile(filepath, 'utf8');
  const shader = new Shader(source);
  return {
    filename,
    source,
    index,
    shader,
    declarations: shader.listDeclarations(),
  };
}

/**
 * Load all the shaders for the given programs.
 */
async function readShaders(
  programs: Program[],
): Promise<Map<string, ShaderInfo>> {
  const shaderSet = new Set<string>();
  for (const program of programs) {
    for (const filename of [program.vertex, program.fragment]) {
      shaderSet.add(filename);
    }
  }
  const filenames = Array.from(shaderSet).sort();
  const promises: Promise<ShaderInfo>[] = [];
  // sort gives deterministic build
  for (let index = 0; index < filenames.length; index++) {
    promises.push(readShader(filenames[index], index));
  }
  const shaders = new Map<string, ShaderInfo>();
  for (const shader of await Promise.all(promises)) {
    shaders.set(shader.filename, shader);
  }
  return shaders;
}

/**
 * Set of shader programs and the constituent shaders.
 */
export interface ShaderPrograms {
  /** List of shader programs. */
  programs: Program[];
  /** Map from filename to shader information. */
  shaders: Map<string, ShaderInfo>;
  /** Map of renamed uniforms. */
  uniformMap: Map<string, string> | null;
}

/**
 * Read the shaders for a list of programs. Does not fill in uniforms.
 */
export async function readShaderPrograms(
  filename: string,
): Promise<ShaderPrograms> {
  const programs = await readPrograms(filename);
  const shaders = await readShaders(programs);
  for (const program of programs) {
    const programUniforms = new Set<string>();
    for (const filename of [program.vertex, program.fragment]) {
      const info = shaders.get(filename);
      if (info == null) {
        throw new AssertionError('info == null', { filename });
      }
      for (const name of info.declarations.uniforms) {
        programUniforms.add(name);
      }
    }
    program.uniforms = Array.from(programUniforms).sort();
  }
  return { programs, shaders, uniformMap: null };
}
