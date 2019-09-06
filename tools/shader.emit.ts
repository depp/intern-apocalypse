/**
 * Emit shader loading code.
 */

import { Program } from './shader.programs';
import { Declarations, Shader } from './shader.syntax';
import { generatedHeader } from './util';
import { BuildError } from './action';

interface Output {
  stub: string;
  loader: string;
}

function programLoader(
  program: Program,
  decls: ReadonlyMap<string, Declarations>,
): Output {
  const vdecls = decls.get(program.vertex);
  if (vdecls == null) {
    throw new BuildError(`missing vertex decls: ${program.vertex}`);
  }
  const fdecls = decls.get(program.fragment);
  if (fdecls == null) {
    throw new BuildError(`missing vertex decls: ${program.vertex}`);
  }
  const tname = program.name.upperCase + 'Program';
  const uniforms = Array.from(new Set(vdecls.uniforms.concat(fdecls.uniforms)));
  uniforms.sort();

  let stub = `export interface ${tname} extends ShaderProgram {\n`;
  for (const name of uniforms) {
    stub += `  ${name}: WebGLUniformLocation | null;\n`;
  }
  stub += '}\n';
  stub += `export const ${program.name.lowerCase} = `;
  stub += `compileShader(${JSON.stringify(uniforms)}) as ${tname};\n`;

  let loader = '{\n';
  loader += `  name: ${JSON.stringify(program.name.lowerCase)},\n`;
  loader += `  vertex: ${JSON.stringify(program.vertex)},\n`;
  loader += `  fragment: ${JSON.stringify(program.fragment)},\n`;
  const attributes = program.attributes.map(x => (x == null ? '' : x));
  loader += `  attributes: ${JSON.stringify(attributes)},\n`;
  loader += `  uniforms: ${JSON.stringify(uniforms)},\n`;
  loader += `  object: ${program.name.lowerCase},\n`;
  loader += '},\n';

  return { stub, loader };
}

interface Attribute {
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
 * Emit the loader stubs for GLSL shader programs.
 */
export function emitLoader(
  programs: Program[],
  code: ReadonlyMap<string, Shader>,
): string {
  const decls = new Map<string, Declarations>();
  for (const [name, shader] of code.entries()) {
    decls.set(name, shader.listDeclarations());
  }

  const bindings = getAttributeBindings(programs);

  let stubs = '';
  let loaders = '';
  for (const program of programs) {
    const { stub, loader } = programLoader(program, decls);
    if (stubs != '') {
      stubs += '\n';
    }
    stubs += stub;
    loaders += loader;
  }

  let out = '';
  out += generatedHeader;
  out +=
    "import { compileShader, ShaderProgram, ShaderSpec } from './shader';\n";

  // Attribute enum
  out += '\n';
  out += '/** Shader program attribute bindings. */\n';
  out += 'export const enum Attribute {\n';
  for (let i = 0; i < bindings.length; i++) {
    const attribute = bindings[i];
    if (attribute != null) {
      out += `  ${attribute.enumName} = ${i},\n`;
    }
  }
  out += '}\n';
  out += '\n';

  // Object stubs
  out += stubs;
  out += '\n';

  // Specs for debug hot-load
  out += 'export function getShaderSpecs(): ShaderSpec[] {\n';
  out += '  return [\n';
  for (const line of loaders.split('\n')) {
    if (line != '') {
      out += '    ';
      out += line;
      out += '\n';
    }
  }
  out += '  ];\n';
  out += '}\n';

  return out;
}

interface ReleaseData {
  shaders: string;
  uniforms: string;
}

/**
 * Generate short identifiers.
 */
function identgen(): () => string {
  let chars = '';
  for (const start of 'aA') {
    chars += String.fromCharCode(
      ...Array(26)
        .fill(0)
        .map((_, i) => i + start.charCodeAt(0)),
    );
  }
  chars += '_0123456789';
  const data: number[] = [0];
  return function(): string {
    const r = data.map(i => chars.charAt(i)).join('');
    let i = data.length - 1;
    while (i >= 0) {
      data[i]++;
      if ((i && data[i] < chars.length) || data[i] < chars.length - 10) {
        break;
      }
      data[i--] = 0;
    }
    if (i < 0) {
      data.unshift(0);
    }
    return r;
  };
}

function encodeStrings(ss: string[]): string {
  let compact = true;
  for (const s of ss) {
    if (s.length != 1) {
      compact = false;
      break;
    }
  }
  if (compact) {
    return JSON.stringify(ss.join(''));
  }
  return JSON.stringify(ss);
}

export function emitReleaseData(
  programs: Program[],
  code: ReadonlyMap<string, Shader>,
): ReleaseData {
  // Get attribute bindings for each vertex shader.
  const bindings = getAttributeBindings(programs);

  // Collect all identifiers used in all programs, except 'main'.
  const attributeSet = new Set<string>();
  const uniformSet = new Set<string>();
  const localSet = new Set<string>();
  const idents = new Map<string, number>();
  let numAttributes = 0;
  for (const shader of code.values()) {
    const decls = shader.listDeclarations();
    for (const name of decls.attributes) {
      attributeSet.add(name);
    }
    numAttributes = Math.max(numAttributes, decls.attributes.length);
    for (const name of decls.uniforms) {
      uniformSet.add(name);
    }
    for (const name of decls.locals) {
      localSet.add(name);
    }
    for (const ident of shader.allIdentifiers()) {
      idents.set(ident, (idents.get(ident) || 0) + 1);
    }
  }
  for (const name of attributeSet) {
    if (uniformSet.has(name)) {
      // Can't do renaming if this is true.
      throw new BuildError(
        `name ${JSON.stringify(name)} is both attribute and uniform`,
      );
    }
  }
  localSet.delete('main');

  // Sort by usage.
  const identList = Array.from(idents);
  identList.sort((x, y) => {
    if (x[1] < y[1]) {
      return 1;
    } else if (x[1] > y[1]) {
      return -1;
    } else if (x[0] < y[0]) {
      return -1;
    } else if (x[0] > y[0]) {
      return 1;
    } else {
      return 0;
    }
  });

  // Generate new, short identifiers. We use the same mapping across all files,
  // except for attributes, to make varyings work and improve compression.
  const gen = identgen();
  const identMap = new Map<string, string>();
  const attributeSlots: string[] = [];
  for (let i = 0; i < bindings.length; i++) {
    const shortName = gen();
    attributeSlots.push(shortName);
    const binding = bindings[i];
    if (binding != null) {
      identMap.set(binding.glName, shortName);
    }
  }
  const uniformMap = new Map<string, string>();
  for (const [name] of identList) {
    if (uniformSet.has(name) && !identMap.has(name)) {
      const ident = gen();
      identMap.set(name, ident);
      uniformMap.set(name, ident);
    }
  }
  for (const [name] of identList) {
    if (localSet.has(name) && !identMap.has(name)) {
      identMap.set(name, gen());
    }
  }
  for (const [name] of identList) {
    if (attributeSet.has(name) && !identMap.has(name)) {
      identMap.set(name, gen());
    }
  }

  // Emit new code.
  const minCode = new Map<string, string>();
  for (const [name, shader] of code.entries()) {
    const minText = shader.emitMinified(identMap);
    minCode.set(name, minText);
  }

  // Create output.
  let shaders =
    '/* This code is automatically generated. */\n' +
    "import { compileShader } from './shader';\n";
  for (const program of programs) {
    const vshader = code.get(program.vertex);
    if (vshader == null) {
      throw new Error('assertion failed: vshader != null');
    }
    const fshader = code.get(program.fragment);
    if (fshader == null) {
      throw new Error('assertion failed: fshader != null');
    }
    const vdecls = vshader.listDeclarations();
    const fdecls = fshader.listDeclarations();
    const uniforms = Array.from(
      new Set([...vdecls.uniforms, ...fdecls.uniforms]),
    ).map(x => {
      const id = uniformMap.get(x);
      if (id == null) {
        throw new Error('assertion failed: id != null');
      }
      return id;
    });
    const bindings = program.attributes.map((_, i) => attributeSlots[i]);
    shaders += `export let ${program.name.lowerCase} = compileShader(`;
    shaders += encodeStrings(uniforms);
    shaders += ', ';
    shaders += encodeStrings(bindings);
    shaders += ', ';
    shaders += JSON.stringify(minCode.get(program.vertex));
    shaders += ', ';
    shaders += JSON.stringify(minCode.get(program.fragment));
    shaders += ');\n';
  }

  const uobj: { [s: string]: string } = {};
  for (const [key, value] of uniformMap.entries()) {
    uobj[key] = value;
  }

  return {
    shaders,
    uniforms: JSON.stringify(uobj),
  };
}
