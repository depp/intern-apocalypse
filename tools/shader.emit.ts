/**
 * Emit shader loading code.
 */

import { Program } from './shader.programs';
import { Node, Declarations, listDeclarations } from './shader.syntax';

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.substring(1);
}

function programStub(
  program: Program,
  decls: ReadonlyMap<string, Declarations>,
): string {
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

  let out = `export interface ${tname} extends ShaderProgram {\n`;
  for (const name of uniforms) {
    out += `  ${name}: WebGLUniformLocation | null;\n`;
  }
  out += '}\n';
  out += `export const ${program.name} = compileProgram() as ${tname};\n`;
  return out;
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
  let out =
    '/* This code is automatically generated. */\n' +
    "import { compileShader, ShaderProgram } from './shader';\n";
  for (const program of programs) {
    out += '\n';
    out += programStub(program, decls);
  }
  return out;
}
