/**
 * Compact binary data encoding system.
 *
 * The system encodes numeric arrays containing values from 0-91. It uses
 * printable ASCII characters, but no spaces.
 */

import { AssertionError } from '../debug/debug';

/** Maximum value in the data stream. */
export const dataMax = 91;

// Character 39 <'> and 92 <\> are excluded.

/**
 * Decode a data string to a byte array.
 */
export function decode(s: string): Uint8Array {
  return new Uint8Array(s.length).map(
    (_, i) =>
      s.charCodeAt(i) -
      33 -
      (((s.charCodeAt(i) > 34) as unknown) as number) -
      (((s.charCodeAt(i) > 92) as unknown) as number),
  );
}

/**
 * Encode a byte array as a data string.
 */
export function encode(a: Uint8Array): string {
  const max = Math.max(...a);
  if (max > dataMax) {
    throw new AssertionError(`data value out of range: ${max}`);
  }
  return String.fromCharCode(
    ...a.map(
      x =>
        x +
        33 +
        (((x > 0) as unknown) as number) +
        (((x > 57) as unknown) as number),
    ),
  );
}

/** Quantize and clamp a number for inclusion in the data stream. */
export function toDataClamp(x: number): number {
  const y = Math.round(x);
  if (y < 0) {
    return 0;
  } else if (y > dataMax) {
    return dataMax;
  } else {
    return y;
  }
}

/** Decode an exponential value from the data stream. */
export function decodeExponential(x: number): number {
  // The range is -63 dB to +20 dB.
  return 0.9 ** (69 - x);
}

/** Encode an exponential value for the data stream */
export function encodeExponential(x: number): number {
  if (x <= 0) {
    return -1;
  }
  return 69 - Math.log(x) / Math.log(0.9);
}
