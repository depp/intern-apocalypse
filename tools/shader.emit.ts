/**
 * Emit shader loading code.
 */

import { Program } from './shader.programs';
import { Node, Declarations, listDeclarations } from './shader.syntax';

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.substring(1);
}

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
  const tname = titleCase(program.name) + 'Program';
  const uniforms = Array.from(new Set(vdecls.uniforms.concat(fdecls.uniforms)));
  uniforms.sort();

  let stub = `export interface ${tname} extends ShaderProgram {\n`;
  for (const name of uniforms) {
    stub += `  ${name}: WebGLUniformLocation | null;\n`;
  }
  stub += '}\n';
  stub += `export const ${program.name} = compileProgram() as ${tname};\n`;

  let loader = '{\n';
  loader += `  name: ${JSON.stringify(program.name)},\n`;
  loader += `  vertex: ${JSON.stringify(program.vertex)},\n`;
  loader += `  fragment: ${JSON.stringify(program.fragment)},\n`;
  loader += `  attributes: ${JSON.stringify(program.attributes)},\n`;
  loader += `  uniforms: ${JSON.stringify(uniforms)},\n`;
  loader += `  object: ${program.name},\n`;
  loader += '},\n';

  return { stub, loader };
}

/**
 * Emit the loader stubs for GLSL shader programs.
 */
export function emitLoader(
  programs: Program[],
  code: ReadonlyMap<string, Node>,
): string {
  const decls = new Map<string, Declarations>();
  for (const [name, ast] of code.entries()) {
    decls.set(name, listDeclarations(ast));
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
    '/* This code is automatically generated. */\n' +
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
