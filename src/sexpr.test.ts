import {
  TokenType,
  Token,
  tokenize,
  parseSExpr,
  SExprType,
  SExpr,
  SymbolExpr,
  printSExpr,
  ListExpr,
} from './sexpr';

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
    { type: TokenType.End, text: '', sourcePos: 19 },
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

test('parse', () => {
  const text = 'abc (def ghi) (jkl (() 1 2 3))';
  const nodes = parseSExpr(text);
  const root: ListExpr = {
    type: SExprType.List,
    sourceStart: 0,
    sourceEnd: text.length,
    items: nodes,
  };
  const expect: any = ['abc', ['def', 'ghi'], ['jkl', [[], '1', '2', '3']]];
  function compare(x: SExpr, y: any): void {
    switch (x.type) {
      case SExprType.Symbol:
        const sym = x as SymbolExpr;
        if (typeof y != 'string') {
          throw new Error(
            `invalid type: got ${printSExpr(x)}, expected ${JSON.stringify(y)}`,
          );
        }
        if (sym.name != y) {
          throw new Error(
            `incorrect name: got ${JSON.stringify(
              sym.name,
            )}, expected ${JSON.stringify(y)}`,
          );
        }
        break;
      case SExprType.List:
        const list = x as ListExpr;
        if (typeof y != 'object') {
          throw new Error(
            `invalid type: got ${printSExpr(x)}, expected ${JSON.stringify(y)}`,
          );
        }
        if (list.items.length != y.length) {
          throw new Error(
            `invalid list length: got ${printSExpr(
              x,
            )}, expected ${JSON.stringify(y)}`,
          );
        }
        for (let i = 0; i < y.length; i++) {
          compare(list.items[i], y[i]);
        }
        break;
      default:
        throw new Error(`unknown type ${x.type}`);
    }
  }
  compare(root, expect);
});
