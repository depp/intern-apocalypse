/**
 * Functions for working with GLSL shader syntax.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Node } from 'glsl-parser/direct';
import tokenString = require('glsl-tokenizer/string');
import parseArray = require('glsl-parser/direct');

export { Node };

/** Parse a GLSL shader. */
function parseShader(source: string): Node {
  return parseArray(tokenString(source));
}

/**
 * Load all of the given shaders.
 */
export async function loadShaders(
  dirname: string,
  sources: string[],
): Promise<Map<string, Node>> {
  const texts = new Map<string, Promise<string>>();
  function readText(name: string): Promise<string> {
    let text = texts.get(name);
    if (text == null) {
      text = fs.promises.readFile(path.join(dirname, name), 'utf8');
      texts.set(name, text);
    }
    return text;
  }
  const set = new Set<string>();
  const asts = new Map<string, Node>();
  const promises: Promise<void>[] = [];
  for (const name of sources) {
    if (!asts.has(name)) {
      set.add(name);
      promises.push(
        (async () => {
          asts.set(name, parseShader(await readText(name)));
        })(),
      );
    }
  }
  await Promise.all(promises);
  return asts;
}

/** The uniform and attribute declarations in a GLSL shader. */
export interface Declarations {
  attributes: string[];
  uniforms: string[];
}

/** List the uniforms and attributes in a GLSL shader. */
export function listDeclarations(ast: Node): Declarations {
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
