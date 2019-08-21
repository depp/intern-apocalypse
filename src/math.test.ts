import { Vector, vector, lineIntersectsCircle } from './math';

describe('lineIntersectsCircle', () => {
  const v1 = vector(3, 3);
  const v2 = vector(9, 11);
  interface Case {
    name: string;
    c: Vector;
    radius: number;
    result: boolean;
  }
  const tests: Case[] = [
    {
      name: 'v1.true',
      c: vector(1, 3),
      radius: 2,
      result: true,
    },
    {
      name: 'v1.false',
      c: vector(1, 3),
      radius: 1,
      result: false,
    },
    {
      name: 'v2.true',
      c: vector(9, 13),
      radius: 2,
      result: true,
    },
    {
      name: 'v2.false',
      c: vector(9, 13),
      radius: 1,
      result: false,
    },
    {
      name: 'middle.true',
      c: vector(2, 10),
      radius: 6,
      result: true,
    },
    {
      name: 'middle.false',
      c: vector(2, 10),
      radius: 4,
      result: false,
    },
  ];
  for (const t of tests) {
    test(t.name, () => {
      expect(lineIntersectsCircle(v1, v2, t.c, t.radius)).toBe(t.result);
    });
  }
});
