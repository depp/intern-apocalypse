import { SourceText, SourcePos } from './sourcepos';

test('sourcepos', () => {
  const text = 'abc\n\nd';
  const src = new SourceText(text);
  const locs: SourcePos[] = [
    { lineno: 1, colno: 1 },
    { lineno: 1, colno: 2 },
    { lineno: 1, colno: 3 },
    { lineno: 1, colno: 4 },
    { lineno: 2, colno: 1 },
    { lineno: 3, colno: 1 },
    { lineno: 4, colno: 1 },
  ];
  if (locs.length != text.length + 1) {
    throw new Error(`mismatch: ${locs.length} != ${text.length + 1}`);
  }
  for (let i = 0; i < locs.length; i++) {
    const got = src.lookup(i);
    const want = locs[i];
    if (got.lineno != want.lineno || got.colno != want.colno) {
      throw new Error(
        `loc ${i}: got ${got.lineno}:${got.colno}, expect ${want.lineno}:${want.colno}`,
      );
    }
  }
});
