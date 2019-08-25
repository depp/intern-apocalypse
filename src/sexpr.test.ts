import { TokenType, Token, tokenize } from './sexpr';

function formatToken(tok: Token): string {
  return `(${TokenType[tok.type]},${JSON.stringify(tok.text)},${
    tok.sourcePos
  })`;
}

test('tokenize', () => {
  const tokens = tokenize('(abc) ; comment\ndef');
  const expect: Token[] = [
    { type: TokenType.OpenParen, text: '(', sourcePos: 0 },
    { type: TokenType.Symbol, text: 'abc', sourcePos: 1 },
    { type: TokenType.CloseParen, text: ')', sourcePos: 4 },
    { type: TokenType.Symbol, text: 'def', sourcePos: 16 },
  ];
  if (tokens.length != expect.length) {
    throw new Error(`got ${tokens.length} tokens, expect ${expect.length}`);
  }
  for (let i = 0; i < expect.length; i++) {
    const tt = tokens[i];
    const et = expect[i];
    if (
      tt.type != et.type ||
      tt.text != et.text ||
      tt.sourcePos != et.sourcePos
    ) {
      throw new Error(
        `got token ${formatToken(tt)}, expect ${formatToken(et)}`,
      );
    }
  }
});
