import * as fs from 'fs';

import { Names, convertName } from './util';

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
}

/** Read shader programs. */
export async function readPrograms(filename: string): Promise<Program[]> {
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
    });
  }
  return result;
}

/** List all source files in the list of programs. */
export function programSources(programs: Program[]): string[] {
  const result: string[] = [];
  for (const program of programs) {
    result.push(program.vertex, program.fragment);
  }
  return result;
}
