export const enum Opcode {
  Track,
  Tempo,
  Transpose,
  Inversion,
  Reverse,
  Skip,
  Notes, // Must be last.
}

/** Offset for signed numbers. */
export const signedOffset = 48;

/** Special note: rewind to beginning of pattern. */
export const noteRewind = 90;
