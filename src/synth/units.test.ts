import { Units, multiplyUnits } from './units';

test('multiply', () => {
  interface Case {
    units: Units[];
    result: Units;
  }
  const cases: Case[] = [{ units: [], result: Units.None }];
  for (const key of Object.keys(Units)) {
    const value = Units[key as any];
    if (typeof value == 'number') {
      if (value == Units.Decibel) {
        continue;
      }
      const units = value as Units;
      cases.push({ units: [value], result: value });
    }
  }
  cases.push(
    { units: [Units.None, Units.Second, Units.None], result: Units.Second },
    { units: [Units.Second, Units.Hertz], result: Units.None },
  );
  for (const tcase of cases) {
    const result = multiplyUnits(tcase.units);
    if (result != tcase.result) {
      const input = `[${tcase.units.map(x => Units[x]).join(', ')}]`;
      const output = Units[result];
      const expect = Units[tcase.result];
      throw new Error(`multiply ${input}: got ${output}, expect ${expect}`);
    }
  }
});
