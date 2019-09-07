/**
 * Various utility functions.
 */

/**
 * Clamp a number to the given range.
 * @param x The number to clamp.
 * @param min The minimum value of the result.
 * @param max The maximum value of the result.
 */
export function clamp(x: number, min: number = 0, max: number = 1): number {
  return Math.max(min, Math.min(max, x));
}

/**
 * Return the smallest power of two not smaller than the input.
 */
export function roundUpPow2(x: number): number {
  let i = 0;
  while (i < 32 && x > 1 << i) {
    i++;
  }
  return 1 << i;
}
