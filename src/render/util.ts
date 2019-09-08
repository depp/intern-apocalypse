import { clamp } from '../lib/util';

/* A unit quad as two triangles. Index, XY, and UV coordinates. */
export const quad: readonly (readonly number[])[] = [
  [0, -1, -1, 0, 1],
  [1, 1, -1, 1, 1],
  [2, -1, 1, 0, 0],
  [3, -1, 1, 0, 0],
  [4, 1, -1, 1, 1],
  [5, 1, 1, 1, 0],
];

/** Convert a floating-point number to an 8-bit number. */
function floatTo8(x: number): number {
  return clamp((x * 256) | 0, 0, 255);
}

/** Pack a color in a 32-bit signed integer. */
export function packColor(
  r: number,
  g: number,
  b: number,
  a: number = 1,
): number {
  return (
    floatTo8(r) | (floatTo8(g) << 8) | (floatTo8(b) << 16) | (floatTo8(a) << 24)
  );
}
