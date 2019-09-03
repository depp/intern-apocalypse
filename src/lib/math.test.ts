import {
  Vector,
  vector,
  lineIntersectsCircle,
  lineLineIntersection,
} from './math';

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
      expect(lineIntersectsCircle(v1, v2, t.c, t.radius ** 2)).toBe(t.result);
    });
  }
});

describe('lineLineIntersection', () => {
  interface Case {
    name: string;
    v0: Vector;
    v1: Vector;
    v2: Vector;
    v3: Vector;
    result: number;
  }
  const tests: Case[] = [
    {
      name: 'cross.short',
      v0: vector(1, 1),
      v1: vector(2, 2),
      v2: vector(2, 1),
      v3: vector(1, 2),
      result: 0.5,
    },
    {
      name: 'cross.long',
      v0: vector(1, 1),
      v1: vector(5, 5),
      v2: vector(2, 1),
      v3: vector(1, 2),
      result: 0.125,
    },
    {
      name: 'plus.intersect',
      v0: vector(2, -5),
      v1: vector(2, 5),
      v2: vector(5, 0),
      v3: vector(1, 0),
      result: 0.5,
    },
    {
      name: 'plus.degen.v0',
      v0: vector(2, 0),
      v1: vector(2, 5),
      v2: vector(5, 0),
      v3: vector(1, 0),
      result: 0,
    },
    {
      name: 'plus.degen.v1',
      v0: vector(2, -5),
      v1: vector(2, 0),
      v2: vector(5, 0),
      v3: vector(1, 0),
      result: 1,
    },
    {
      name: 'plus.degen.v2',
      v0: vector(2, -5),
      v1: vector(2, 5),
      v2: vector(2, 0),
      v3: vector(1, 0),
      result: 0.5,
    },
    {
      name: 'plus.degen.v3',
      v0: vector(2, -5),
      v1: vector(2, 5),
      v2: vector(5, 0),
      v3: vector(2, 0),
      result: 0.5,
    },
    {
      name: 'plus.miss.v0',
      v0: vector(2, 1),
      v1: vector(2, 5),
      v2: vector(5, 0),
      v3: vector(1, 0),
      result: -1,
    },
    {
      name: 'plus.miss.v1',
      v0: vector(2, -5),
      v1: vector(2, -1),
      v2: vector(5, 0),
      v3: vector(1, 0),
      result: -1,
    },
    {
      name: 'plus.miss.v2',
      v0: vector(2, -5),
      v1: vector(2, 5),
      v2: vector(1, 0),
      v3: vector(0, 0),
      result: -1,
    },
    {
      name: 'plus.miss.v3',
      v0: vector(2, -5),
      v1: vector(2, 5),
      v2: vector(5, 0),
      v3: vector(3, 0),
      result: -1,
    },
  ];
  for (const t of tests) {
    test(t.name, () => {
      expect(lineLineIntersection(t.v0, t.v1, t.v2, t.v3)).toBe(t.result);
      expect(lineLineIntersection(t.v0, t.v1, t.v3, t.v2)).toBe(-1);
      expect(lineLineIntersection(t.v1, t.v0, t.v2, t.v3)).toBe(-1);
    });
  }
});
