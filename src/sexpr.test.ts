import {
  TokenType,
  Token,
  tokenize,
  parseSExpr,
  SExpr,
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
  const text = 'abc (def ghi) (jkl2 (() 1 2kHz 3_s +.4 -5))';
  const nodes = parseSExpr(text);
  const root: ListExpr = {
    type: 'list',
    sourceStart: 0,
    sourceEnd: text.length,
    items: nodes,
  };
  function list(...items: SExpr[]): SExpr {
    return { type: 'list', sourceStart: 0, sourceEnd: 0, items };
  }
  function sym(name: string): SExpr {
    return { type: 'symbol', sourceStart: 0, sourceEnd: 0, name };
  }
  function num(value: string, prefix: string = '', units: string = ''): SExpr {
    return {
      type: 'number',
      sourceStart: 0,
      sourceEnd: 0,
      value,
      prefix,
      units,
    };
  }
  const expect: SExpr = list(
    sym('abc'),
    list(sym('def'), sym('ghi')),
    list(
      sym('jkl2'),
      list(
        list(),
        num('1'),
        num('2', 'k', 'Hz'),
        num('3', '', 's'),
        num('+.4'),
        num('-5'),
      ),
    ),
  );
  function print(x: SExpr): string {
    switch (x.type) {
      case 'symbol':
        return `symbol(${JSON.stringify(x.name)})`;
      case 'number':
        return `number(${JSON.stringify(x.value)}, ${JSON.stringify(
          x.prefix,
        )}, ${JSON.stringify(x.units)})`;
      case 'list':
        return `[${x.items.map(print).join(' ')}]`;
      default:
        const dummy: never = x;
        return '';
    }
  }
  function compare(x: SExpr, y: SExpr): void {
    switch (x.type) {
      case 'symbol':
        if (y.type == 'symbol' && x.name == y.name) {
          return;
        }
        break;
      case 'number':
        if (
          y.type == 'number' &&
          x.value == y.value &&
          x.prefix == y.prefix &&
          x.units == y.units
        ) {
          return;
        }
        break;
      case 'list':
        if (y.type == 'list' && x.items.length == y.items.length) {
          for (let i = 0; i < x.items.length; i++) {
            compare(x.items[i], y.items[i]);
          }
          return;
        }
        break;
      default:
        const dummy: never = x;
        break;
    }
    throw new Error(`got: ${print(x)}, expected: ${print(y)}`);
  }
  compare(root, expect);
});
