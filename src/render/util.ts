import { clamp } from '../lib/util';
import { makeRandom } from '../model/random';

/* A unit quad as two triangles. Index, XY. */
export const quad: readonly (readonly number[])[] = [
  [0, 0, 0],
  [1, 1, 0],
  [2, 0, 1],
  [3, 0, 1],
  [4, 1, 0],
  [5, 1, 1],
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

/** A WebGL buffer with data from makeRandom. */
export let randomVec4: WebGLBuffer | null | undefined;

/** Initialize renderer utility library. Requires WebGL context. */
export function initRendererUtil(): void {
  randomVec4 = makeRandom();
}
