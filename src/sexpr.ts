export enum TokenType {
  End,
  Error,
  Whitespace,
  Comment,
  Symbol,
  OpenParen,
  CloseParen,
}

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

/** Split a string into a list of tokens. */
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
  return tokens;
}
