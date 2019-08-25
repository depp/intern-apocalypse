import { AssertionError } from './debug';

/** Lexical token types. */
export enum TokenType {
  End,
  Error,
  Whitespace,
  Comment,
  Symbol,
  OpenParen,
  CloseParen,
}

/** Lexical token. */
export interface Token {
  readonly type: TokenType;
  readonly text: string;
  readonly sourcePos: number;
}

/** Map from initial code points to token types. */
const tokenTypes: readonly TokenType[] = (() => {
  const result: TokenType[] = Array(128).fill(TokenType.Error);
  for (let i = 0; i < 26; i++) {
    result[65 + i] = TokenType.Symbol;
    result[97 + i] = TokenType.Symbol;
  }
  for (let i = 0; i < 10; i++) {
    result[48 + i] = TokenType.Symbol;
  }
  const map: [TokenType, string][] = [
    [TokenType.Symbol, '-!$%&*+./:<=>?@^_~'],
    [TokenType.OpenParen, '('],
    [TokenType.CloseParen, ')'],
    [TokenType.Whitespace, '\t\n\r '],
    [TokenType.Comment, ';'],
  ];
  for (const [type, chars] of map) {
    for (const char of chars) {
      result[char.codePointAt(0)!] = type;
    }
  }
  return result;
})();

/** Split a string into a list of lexical tokens. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const matchToken = /[-!$%&*+./:<=>?@^_~0-9a-zA-Z]+|[()]|[ \n\r\t]+|;.*?$/my;
  let match: RegExpExecArray | null;
  while ((match = matchToken.exec(source)) != null) {
    const text = match[0];
    const type = tokenTypes[text.codePointAt(0)!] || TokenType.Error;
    switch (type) {
      case TokenType.Whitespace:
      case TokenType.Comment:
        break;
      default:
        tokens.push({ type, text, sourcePos: match.index });
        break;
    }
  }
  tokens.push({ type: TokenType.End, text: '', sourcePos: source.length });
  return tokens;
}

/** S-expression node type. */
export enum SExprType {
  Symbol,
  List,
}

/** S-expression node base. */
export interface SExpr {
  readonly type: SExprType;
  readonly sourceStart: number;
  readonly sourceEnd: number;
}

/** S-expression symbol. */
export interface SymbolExpr extends SExpr {
  readonly name: string;
}

/** S-expression list. */
export interface ListExpr extends SExpr {
  readonly items: readonly SExpr[];
}

/** An error parsing an S-expression. */
export class SyntaxError extends Error {
  sourcePos: number;
  constructor(message: string, sourcePos: number) {
    super(message);
    this.sourcePos = sourcePos;
  }
}

/** Parse a string into a list of top-level S-expressions. */
export function parseSExpr(source: string): SExpr[] {
  const tokens = tokenize(source);
  let tokenPos = 0;
  function parseNode(list: SExpr[]): boolean {
    const start = tokens[tokenPos];
    switch (start.type) {
      case TokenType.Symbol:
        tokenPos++;
        list.push({
          type: SExprType.Symbol,
          sourceStart: start.sourcePos,
          sourceEnd: start.sourcePos + start.text.length,
          name: start.text,
        } as SymbolExpr);
        return true;
      case TokenType.OpenParen:
        tokenPos++;
        const items: SExpr[] = [];
        while (parseNode(items)) {}
        const end = tokens[tokenPos];
        if (end.type != TokenType.CloseParen) {
          throw new SyntaxError('unclosed "("', start.sourcePos);
        }
        tokenPos++;
        list.push({
          type: SExprType.List,
          sourceStart: start.sourcePos,
          sourceEnd: end.sourcePos,
          items,
        } as ListExpr);
        return true;
      default:
        return false;
    }
  }
  const toplevel: SExpr[] = [];
  while (parseNode(toplevel)) {}
  const tok = tokens[tokenPos];
  if (tok.type != TokenType.End) {
    throw new SyntaxError('unexpected token', tok.sourcePos);
  }
  return toplevel;
}

/** Print an S-expression as a string. */
export function printSExpr(expr: SExpr): string {
  switch (expr.type) {
    case SExprType.Symbol:
      const sym = expr as SymbolExpr;
      return sym.name;
    case SExprType.List:
      const list = expr as ListExpr;
      return `(${list.items.map(printSExpr).join(' ')})`;
    default:
      throw new AssertionError('unknown expr type');
  }
}
