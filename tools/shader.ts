/**
 * Generate shader loading code.
 *
 * Right now, this just prints out the attributes and uniforms.
 */

import * as fs from 'fs';

import { Node } from 'glsl-parser/direct';
import tokenString = require('glsl-tokenizer/string');
import parseArray = require('glsl-parser/direct');

/**
 * Load a GLSL shader file and parse it.
 */
async function loadShader(filename: string): Promise<Node> {
  const data = await fs.promises.readFile(filename, 'utf8');
  const tokens = tokenString(data);
  return parseArray(tokens);
}

/** The uniform and attribute declarations in a GLSL shader. */
interface Declarations {
  attributes: string[];
  uniforms: string[];
}

/** List the uniforms and attributes in a GLSL shader. */
function listDeclarations(ast: Node): Declarations {
  const attributes: string[] = [];
  const uniforms: string[] = [];
  function readDecl(node: Node): void {
    let arr: string[];
    switch (node.token.data) {
      case 'attribute':
        arr = attributes;
        break;
      case 'uniform':
        arr = uniforms;
        break;
      default:
        return;
    }
    for (const c of node.children) {
      if (c.type == 'decllist') {
        for (const c1 of c.children) {
          if (c1.type == 'ident') {
            arr.push(c1.token.data);
          }
        }
      }
    }
  }
  function visit(node: Node): void {
    if (node.type == 'decl') {
      readDecl(node);
    }
    for (const child of node.children) {
      visit(child);
    }
  }
  visit(ast);
  return { attributes, uniforms };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length == 0) {
    console.error('required file argument');
    process.exit(2);
  }
  try {
    for (const arg of args) {
      process.stdout.write(`${arg}:\n`);
      const ast = await loadShader(arg);
      const { attributes, uniforms } = listDeclarations(ast);
      process.stdout.write('  attributes:\n');
      for (const name of attributes) {
        process.stdout.write(`    - ${name}\n`);
      }
      process.stdout.write('  uniforms:\n');
      for (const name of uniforms) {
        process.stdout.write(`    - ${name}\n`);
      }
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
