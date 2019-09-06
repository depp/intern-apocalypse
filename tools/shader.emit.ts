/**
 * Emit shader loading code.
 */

import { Program } from './shader.programs';
import { Declarations, Shader } from './shader.syntax';
import { generatedHeader } from './util';

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
    throw new Error(`missing vertex decls: ${program.vertex}`);
  }
  const fdecls = decls.get(program.fragment);
  if (fdecls == null) {
    throw new Error(`missing vertex decls: ${program.vertex}`);
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

  let out =
    generatedHeader +
    "import { compileShader, ShaderProgram, ShaderSpec } from './shader';\n" +
    '\n';
  out += stubs;
  out += '\n';
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
  const attributeBindings = new Map<string, (string | null)[]>();
  let maxAttribs = 0;
  for (const program of programs) {
    const { vertex, attributes } = program;
    maxAttribs = Math.max(maxAttribs, attributes.length);
    let bindings = attributeBindings.get(vertex);
    if (!bindings) {
      attributeBindings.set(vertex, Array.from(attributes));
    } else {
      for (let i = 0; i < attributes.length; i++) {
        const oldName = bindings[i];
        const newName = attributes[i];
        if (newName == null) {
          continue;
        }
        if (oldName && newName && oldName != newName) {
          throw new Error(
            `cannot bind attribute ${i} to both ` +
              `${JSON.stringify(oldName)} and ` +
              `${JSON.stringify(newName)}`,
          );
        }
        bindings[i] = oldName || newName;
      }
    }
  }

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
      throw new Error(
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
  const attrMap = Array(maxAttribs)
    .fill(0)
    .map(() => gen());
  const identMap = new Map<string, string>();
  const uniformMap = new Map<string, string>();
  for (const [name] of identList) {
    if (uniformSet.has(name)) {
      const ident = gen();
      identMap.set(name, ident);
      uniformMap.set(name, ident);
    }
  }
  for (const [name] of identList) {
    if (localSet.has(name)) {
      identMap.set(name, gen());
    }
  }
  for (const [name] of identList) {
    if (attributeSet.has(name)) {
      identMap.set(name, gen());
    }
  }

  // Emit new code.
  const minCode = new Map<string, string>();
  for (const [name, shader] of code.entries()) {
    let localIdentMap = identMap;
    const bindings = attributeBindings.get(name);
    if (bindings) {
      localIdentMap = new Map(localIdentMap);
      for (let i = 0; i < bindings.length; i++) {
        const attribute = bindings[i];
        if (attribute != null) {
          localIdentMap.set(attribute, attrMap[i]);
        }
      }
    }
    const minText = shader.emitMinified(localIdentMap);
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
    const bindings = program.attributes.map((_, i) => attrMap[i]);
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
