import { convertName, Names } from './util';

function formatNames(names: Names): string {
  const { upperCase, lowerCase } = names;
  return `upper=${JSON.stringify(upperCase)} lower=${JSON.stringify(
    lowerCase,
  )}`;
}

test('convertName', () => {
  type TestCase = [string, string, string];
  const cases: TestCase[] = [
    ['abc', 'Abc', 'abc'],
    ['abc-def', 'AbcDef', 'abcDef'],
    ['getURL', 'GetURL', 'getURL'],
    ['--my..string__', 'MyString', 'myString'],
    ['the123solution', 'The123Solution', 'the123Solution'],
  ];
  for (const [input, upperCase, lowerCase] of cases) {
    const output = convertName(input);
    if (upperCase != output.upperCase || lowerCase != output.lowerCase) {
      throw new Error(
        `convertName(${JSON.stringify(input)}): ` +
          `got ${formatNames(output)}, ` +
          `expect ${formatNames({ upperCase, lowerCase })}`,
      );
    }
  }
});

test('convertNameFail', () => {
  const cases: string[] = ['0abc', '---', '', 'abc/'];
  for (const input of cases) {
    let output: Names;
    try {
      output = convertName(input);
    } catch (e) {
      continue;
    }
    throw new Error(
      `convertName(${JSON.stringify(input)}): ` +
        `got ${formatNames(output)}, expected exception`,
    );
  }
});
