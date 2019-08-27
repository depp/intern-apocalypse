declare module 'glsl-tokenizer/string' {
  function tokenString(
    src: string,
    opts?: tokenString.Options,
  ): tokenString.Token[];
  export = tokenString;
  namespace tokenString {
    export type GLSLVersion = '100 es' | '300 es';

    export interface Options {
      version?: GLSLVersion;
    }

    export type TokenType =
      | 'block-comment'
      | 'line-comment'
      | 'preprocessor'
      | 'operator'
      | 'integer'
      | 'float'
      | 'ident'
      | 'builtin'
      | 'keyword'
      | 'whitespace'
      | 'eof'
      | 'integer';

    export interface Token {
      type: TokenType;
      data: string;
      position: number;
      line: number;
      column: number;
    }
  }
}
