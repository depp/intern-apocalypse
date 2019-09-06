/**
 * Emit shader loading code.
 */

import { ShaderPrograms } from './shader.programs';
import { generatedHeader, prettifyTypeScript } from './util';
import { AssertionError } from '../src/debug/debug';

/** Encode strings compactly. */
function encodeStrings(ss: ArrayLike<string | null>): string {
  let isShort = true;
  let short = '';
  let long: string[] = [];
  for (let i = 0; i < ss.length; i++) {
    const s = ss[i];
    if (s == null) {
      short += ' ';
      long.push('');
    } else {
      long.push(s);
      if (s.length == 1) {
        short += s;
      } else {
        isShort = false;
      }
    }
  }
  return JSON.stringify(isShort ? short : long);
}

/**
 * Emit shader definitions file.
 */
export function emitDefinitions(
  shaderPrograms: ShaderPrograms,
  mode: 'source' | 'release',
): string {
  const { attributes, programs } = shaderPrograms;
  let out = '';
  out += generatedHeader;
  if (mode == 'source') {
    out +=
      "import { compileShader, ShaderProgram, ShaderSpec } from './shader';\n";
  } else {
    out += "import { compileShader } from './shader';\n";
  }
  out += "import { bundledData } from '../lib/global';\n";
  out += "import { shaderOffset } from '../lib/loader';\n";

  if (mode == 'source') {
    // Attribute binding enum
    out += '\n';
    out += '/** Shader program attribute bindings. */\n';
    out += 'export const enum Attribute {\n';
    for (let i = 0; i < attributes.length; i++) {
      const attribute = attributes[i];
      if (attribute != null) {
        out += `  ${attribute.enumName} = ${i},\n`;
      }
    }
    out += '}\n';

    // Shader program objects and type definitions
    out += '\n';
    for (const program of programs) {
      const { name, uniforms } = program;
      const typeName = name.upperCase + 'Program';
      out += `export interface ${typeName} extends ShaderProgram {\n`;
      for (const name of uniforms) {
        out += `  ${name}: WebGLUniformLocation | null;\n`;
      }
      out += '}\n';
      out += `export const ${program.name.lowerCase} = {} as ${typeName};\n`;
    }

    // Shader program specs
    out += '\n';
    out += '/** Get specs for all shader programs. */\n';
    out += 'export function getShaderSpecs(): ShaderSpec[] {\n';
    out += '  return [\n';
    for (const program of programs) {
      const { name, uniforms } = program;
      const attributes = program.attributes.map(x => (x == null ? '' : x));
      out += '    {\n';
      out += `      name: ${JSON.stringify(name.lowerCase)},\n`;
      out += `      vertex: ${JSON.stringify(program.vertex)},\n`;
      out += `      fragment: ${JSON.stringify(program.fragment)},\n`;
      out += `      attributes: ${JSON.stringify(attributes)},\n`;
      out += `      uniforms: ${JSON.stringify(uniforms)},\n`;
      out += `      object: ${name.lowerCase},\n`;
      out += '    },\n';
    }
    out += '  ];\n';
    out += '}\n';
  } else {
    // Shader program objects
    out += '\n;';
    for (const program of programs) {
      out += `export let ${program.name.lowerCase} = {};\n`;
    }
  }

  // Release shader loader
  out += '\n';
  out += '/** Load all the shaders. */\n';
  if (mode == 'source') {
    out += 'export function loadShaders(): void {\n';
  } else {
    out += 'export function loadShaders() {\n';
  }
  for (const program of programs) {
    const vertex = shaderPrograms.shaders.get(program.vertex);
    const fragment = shaderPrograms.shaders.get(program.fragment);
    if (vertex == null || fragment == null) {
      throw new AssertionError('vertex == null || fragment == null');
    }
    const name = program.name.lowerCase;
    const args = [
      name,
      encodeStrings(program.uniforms),
      encodeStrings(program.attributes),
      `bundledData[shaderOffset + ${vertex.index}]`,
      `bundledData[shaderOffset + ${fragment.index}]`,
    ];
    if (mode == 'source') {
      args.push(JSON.stringify(name));
    }
    out += '  compileShader(';
    out += args.join(', ');
    out += ');\n';
  }
  out += '}\n';

  out = prettifyTypeScript(out);
  return out;
}

/**
 * Emit the map for minified uniform identifiers.
 */
export function emitUniformMap(shaderProgram: ShaderPrograms): string {
  const { uniformMap } = shaderProgram;
  if (uniformMap == null) {
    return '{}';
  }
  const obj: any = {};
  for (const [key, value] of uniformMap.entries()) {
    obj[key] = value;
  }
  return JSON.stringify(obj);
}
