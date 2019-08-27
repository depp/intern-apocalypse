declare module 'glsl-parser/direct' {
  import { Token } from 'glsl-tokenizer/string';
  function parseArray(tokens: Token[]): parseArray.Node;
  export = parseArray;
  namespace parseArray {
    export type NodeType =
      | 'stmtlist'
      | 'stmt'
      | 'struct'
      | 'function'
      | 'functionargs'
      | 'decl'
      | 'decllist'
      | 'forloop'
      | 'whileloop'
      | 'if'
      | 'expr'
      | 'precision'
      | 'comment'
      | 'preprocessor'
      | 'keyword'
      | 'ident'
      | 'return'
      | 'continue'
      | 'break'
      | 'discard'
      | 'do-while'
      | 'binary'
      | 'ternary'
      | 'unary';

    // mode, expecting, stage, scope
    export interface Node {
      type: NodeType;
      token: Token;
      children: Node[];
      parent: Node;
      id?: string;
      scope?: { [name: string]: Node };
    }
  }
}
