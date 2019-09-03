import { Chunk, splitLines, splitFields } from './textdata';

function checkOutput(got: Chunk[], expected: Chunk[]): void {
  if (got.length != expected.length) {
    for (const item of got) {
      console.log(item);
    }
    throw new Error(`got ${got.length} items, expected ${expected.length}`);
  }
  for (let i = 0; i < got.length; i++) {
    const g = got[i];
    const e = expected[i];
    if (g.text != e.text || g.sourcePos != e.sourcePos) {
      throw new Error(
        `got ${JSON.stringify(g)}, expected ${JSON.stringify(e)}`,
      );
    }
  }
}

test('lines', () => {
  const output = splitLines('abc\n\ndef\n');
  checkOutput(output, [
    { text: 'abc', sourcePos: 0 },
    { text: '', sourcePos: 4 },
    { text: 'def', sourcePos: 5 },
  ]);
});

test('lines_no_nl', () => {
  const output = splitLines('abc\ndef');
  checkOutput(output, [
    { text: 'abc', sourcePos: 0 },
    { text: 'def', sourcePos: 4 },
  ]);
});

test('fields', () => {
  const output = splitFields({ text: '  abc d    e #fg h', sourcePos: 1000 });
  checkOutput(output, [
    { text: 'abc', sourcePos: 1002 },
    { text: 'd', sourcePos: 1006 },
    { text: 'e', sourcePos: 1011 },
  ]);
});
