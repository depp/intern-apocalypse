import * as fs from 'fs';

import { Names, convertName } from './util';
import { BuildError } from './action';
import { Shader, Declarations } from './shader.syntax';
import { AssertionError } from '../src/debug/debug';

/** A shader program specification. */
export interface Program {
  /** Name of the program. */
  name: Names;
  /** Filename of the vertex shader. */
  vertex: string;
  /** Filename of the fragment shader. */
  fragment: string;
  /** List of attributes to use, in order. */
  attributes: readonly (string | null)[];
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
    for (const attr of attributes) {
      if (typeof attr != 'string' && attr !== null) {
        throw new Error('invalid attribute');
      }
    }
    result.push({
      name: convertName(name),
      vertex,
      fragment,
      attributes,
      uniforms: [],
    });
  }
  return result;
}

/** Information about an attribute binding. */
export interface Attribute {
  /** Name as it appears in shader. */
  glName: string;
  /** Enumeration name of the slot. */
  enumName: string;
}

/** Get the attribute bindings for a set of programs. */
function getAttributeBindings(programs: Program[]): (Attribute | null)[] {
  const rbindings = new Map<string, { index: number; name: string }>();
  const bindings: (Attribute | null)[] = [];
  const names: string[] = [];
  for (const { name, attributes } of programs) {
    const lname = name.lowerCase;
    for (let index = 0; index < attributes.length; index++) {
      const binding = attributes[index];
      if (binding == null) {
        continue;
      }
      if (!/^a[A-Z][A-Za-z0-9]*$/.test(binding)) {
        throw new BuildError(
          `invalid attribute name ${JSON.stringify(binding)}`,
        );
      }
      const otherBinding = rbindings.get(binding);
      if (otherBinding != null) {
        if (otherBinding.index != index) {
          const index2 = otherBinding.index;
          const name2 = otherBinding.name;
          throw new BuildError(
            `cannot bind attribute ${JSON.stringify(binding)} ` +
              'to two different slots: ' +
              `${index2} in ${JSON.stringify(name2)}, ` +
              `${index} in ${JSON.stringify(lname)}`,
          );
        }
        continue;
      }
      while (bindings.length <= index) {
        bindings.push(null);
      }
      const other = bindings[index];
      if (other != null) {
        const binding2 = other.glName;
        const name2 = names[index];
        throw new BuildError(
          `cannot bind attribute slot ${index} to two different names: ` +
            `${JSON.stringify(binding2)} in ${JSON.stringify(name2)}, ` +
            `${JSON.stringify(binding)} in ${JSON.stringify(lname)}`,
        );
      }
      bindings[index] = { glName: binding, enumName: binding.substring(1) };
      rbindings.set(binding, { index, name: lname });
    }
  }
  return bindings;
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
  /** Attribute bindings. */
  attributes: (Attribute | null)[];
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
  const attributes = getAttributeBindings(programs);
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
  return { attributes, programs, shaders, uniformMap: null };
}
