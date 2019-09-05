/**
 * Data encodings for the syntheszier.
 */

import { decodeExponential, encodeExponential } from '../lib/data.encode';

export { decodeExponential, encodeExponential };

/** Decode a bipolar linear ratio from the data stream. */
export function decodeLinear(x: number): number {
  // This gives us a range of -1 to +1, with an extra 1.02.
  return (1 / 45) * (x - 45);
}

/** Encode a bipolar linear value for the data stream. */
export function encodeLinear(x: number): number {
  return (x + 1) * 45;
}

/** Decode a musical note frequency from the data stream. */
export function decodeNote(x: number): number {
  // We started with the standard formula, 440 * 2 ** ((x - A4) / 12).
  // By choosing A4 = 48, we get this formula instead.
  // This gives us the range from A0 to E8, which is a standard piano plus a
  // little extra.
  // In Hz, the range is 27.5 Hz - 5.27 kHz.
  return 27.5 * 2 ** (x / 12);
}

/** Encode a musical note frequency. */
export function encodeNote(x: number): number {
  if (x <= 0) {
    return -1;
  }
  return 12 * Math.log2(x / 27.5);
}

/** Decode a general frequency. */
export function decodeFrequency(x: number): number {
  return 20 * 1.08 ** x;
}

/** Encode a general frequency. */
export function encodeFrequency(x: number): number {
  return Math.log(x / 20) / Math.log(1.08);
}
