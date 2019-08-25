import { AssertionError } from './debug';
import { SourceError, SourceSpan } from './sourcepos';

/** Lexical token types. */
export enum TokenType {
  End,
  Error,
  Whitespace,
  Comment,
  Symbol,
  Number,
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
    result[48 + i] = TokenType.Number;
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
  let pos = 0;
  while ((match = matchToken.exec(source)) != null) {
    pos = matchToken.lastIndex;
    const text = match[0];
    let type = tokenTypes[text.codePointAt(0)!] || TokenType.Error;
    if (
      text.startsWith('.') &&
      text.length >= 2 &&
      '0' <= text[0] &&
      text[0] <= '9'
    ) {
      type = TokenType.Number;
    }
    switch (type) {
      case TokenType.Whitespace:
      case TokenType.Comment:
        break;
      default:
        tokens.push({ type, text, sourcePos: match.index });
        break;
    }
  }
  if (pos != source.length) {
    const text = String.fromCodePoint(source.codePointAt(pos)!);
    tokens.push({ type: TokenType.Error, text, sourcePos: pos });
  }
  tokens.push({ type: TokenType.End, text: '', sourcePos: source.length });
  return tokens;
}

/** S-expression node type. */
export type SExprType = 'list' | 'symbol' | 'number';

/** S-expression symbol. */
export interface SymbolExpr extends SourceSpan {
  readonly type: 'symbol';
  readonly name: string;
}

/** S-expression literal number. */
export interface NumberExpr extends SourceSpan {
  readonly type: 'number';
  readonly value: string;
}

/** S-expression list. */
export interface ListExpr extends SourceSpan {
  readonly type: 'list';
  readonly items: readonly SExpr[];
}

/** S-expression node. */
export type SExpr = SymbolExpr | NumberExpr | ListExpr;

/** An error parsing an S-expression. */
export class SExprSyntaxError extends SourceError {
  constructor(tok: Token, message: string) {
    super(tok.sourcePos, tok.sourcePos + tok.text.length, message);
  }
}

/** Throw an error when encountering an unexpected token while parsing. */
function unexpectedToken(tok: Token): never {
  if (tok.type == TokenType.Error) {
    throw new SExprSyntaxError(
      tok,
      `unexpected character ${JSON.stringify(tok.text)}`,
    );
  }
  throw new SExprSyntaxError(tok, 'unexpected token');
}

/** Regular expression which matches Lisp numeric literals. */
const matchNumber = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;

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
          type: 'symbol',
          sourceStart: start.sourcePos,
          sourceEnd: start.sourcePos + start.text.length,
          name: start.text,
        });
        return true;
      case TokenType.Number:
        if (!start.text.match(matchNumber)) {
          throw new SExprSyntaxError(start, 'invalid numeric literal');
        }
        tokenPos++;
        list.push({
          type: 'number',
          sourceStart: start.sourcePos,
          sourceEnd: start.sourcePos + start.text.length,
          value: start.text,
        });
        return true;
      case TokenType.OpenParen:
        tokenPos++;
        const items: SExpr[] = [];
        while (parseNode(items)) {}
        const end = tokens[tokenPos];
        switch (end.type) {
          case TokenType.CloseParen:
            // Expected.
            break;
          case TokenType.End:
            throw new SExprSyntaxError(start, 'unbalanced "("');
          default:
            unexpectedToken(end);
            break;
        }
        tokenPos++;
        list.push({
          type: 'list',
          sourceStart: start.sourcePos,
          sourceEnd: end.sourcePos + end.text.length,
          items,
        });
        return true;
      default:
        return false;
    }
  }
  const toplevel: SExpr[] = [];
  while (parseNode(toplevel)) {}
  const tok = tokens[tokenPos];
  if (tok.type != TokenType.End) {
    unexpectedToken(tok);
  }
  return toplevel;
}

/** Print an S-expression as a string. */
export function printSExpr(expr: SExpr): string {
  switch (expr.type) {
    case 'symbol':
      return expr.name;
    case 'number':
      return expr.value;
    case 'list':
      return `(${expr.items.map(printSExpr).join(' ')})`;
    default:
      const node: never = expr;
      throw new AssertionError('invalid S-expression type');
  }
}
