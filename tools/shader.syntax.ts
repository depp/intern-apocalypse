/**
 * Functions for working with GLSL shader syntax.
 */

import { Token } from 'glsl-tokenizer/string';
import { Node } from 'glsl-parser/direct';
import tokenString = require('glsl-tokenizer/string');
import parseArray = require('glsl-parser/direct');

/** The uniform and attribute declarations in a GLSL shader. */
export interface Declarations {
  attributes: string[];
  uniforms: string[];
  locals: string[];
}

const swizzleMap = new Map<string, string>();
for (const s of ['xyzw', 'rgba', 'stpq']) {
  for (const c of s) {
    swizzleMap.set(c, s);
  }
}

/**
 * Map a swizzle to the equivalent xyzw swizzle.
 */
function mapSwizzle(s: string): string | null {
  if (s.length > 4) {
    return null;
  }
  let stype: string | undefined;
  let indexes: number[] = [];
  for (const c of s) {
    const ct = swizzleMap.get(c);
    if (ct == null) {
      return null;
    } else if (stype == null) {
      stype = ct;
    } else if (stype != ct) {
      return null;
    }
    indexes.push(ct.indexOf(c));
  }
  return indexes.map(i => 'xyzw'[i]).join('');
}

/**
 * A parsed shader.
 */
export class Shader {
  private readonly tokens: Token[];
  private readonly ast: Node;
  constructor(source: string) {
    this.tokens = tokenString(source);
    this.ast = parseArray(this.tokens);
  }

  /** List the uniforms and attributes in a GLSL shader. */
  listDeclarations(): Declarations {
    const attributes: string[] = [];
    const uniforms: string[] = [];
    const locals: string[] = [];
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
          arr = locals;
          break;
      }
      for (const c of node.children) {
        if (c.type == 'decllist') {
          for (const c1 of c.children) {
            if (c1.type == 'ident') {
              arr.push(c1.token.data);
            }
          }
        } else if (c.type == 'function') {
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
    visit(this.ast);
    return { attributes, uniforms, locals };
  }

  /** List all identifiers in the GLSL shader. */
  allIdentifiers(): string[] {
    const idents: string[] = [];
    function visit(node: Node): void {
      if (node.token.type == 'ident') {
        idents.push(node.token.data);
      }
      for (const c of node.children) {
        visit(c);
      }
    }
    visit(this.ast);
    return idents;
  }

  /** Emit minified code, using the given identifier map. */
  emitMinified(identMap: ReadonlyMap<string, string>): string {
    let out = '';
    let needWhite = false;
    let isDot = false;
    for (const tok of this.tokens) {
      let wasDot = isDot;
      isDot = false;
      switch (tok.type) {
        case 'block-comment':
        case 'line-comment':
        case 'whitespace':
          break;
        case 'keyword':
        case 'builtin':
          if (needWhite) {
            out += ' ';
          }
          out += tok.data;
          needWhite = true;
          break;
        case 'eof':
          break;
        case 'float':
          {
            if (needWhite) {
              out += ' ';
            }
            const m = tok.data.match(
              /^0*((?:[1-9][0-9]*)?\.(?:[0-9]*[1-9])?)0*$/,
            );
            if (m) {
              const d = m[1];
              if (d == '.') {
                out += '0.';
              } else {
                out += d;
              }
            } else {
              out += tok.data;
            }
            needWhite = true;
          }
          break;
        case 'ident':
          if (needWhite) {
            out += ' ';
          }
          let id: string | undefined | null;
          if (wasDot) {
            id = mapSwizzle(tok.data);
          }
          if (!id) {
            id = identMap.get(tok.data);
          }
          if (!id) {
            id = tok.data;
          }
          out += id;
          needWhite = true;
          break;
        case 'integer':
          {
            if (needWhite) {
              out += ' ';
            }
            const m = tok.data.match(/^0*([1-9][0-9]*)?$/);
            if (m) {
              const d = m[1];
              if (d == null) {
                out += '0';
              } else {
                out += d;
              }
            } else {
              out += tok.data;
            }
            needWhite = true;
          }
          break;
        case 'operator':
          if (tok.data == '.') {
            isDot = true;
          }
          out += tok.data;
          needWhite = false;
          break;
        case 'preprocessor':
          if (out != '') {
            out += '\n';
          }
          out += tok.data;
          out += '\n';
          needWhite = false;
        default:
          throw new Error(`unknow token type ${JSON.stringify(tok.type)}`);
      }
    }
    return out;
  }
}
