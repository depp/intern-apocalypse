export const enum Opcode {
  Track,
  Tempo,
  Transpose,
  Inversion,
  Reverse,
  Notes, // Must be last.
}

/** Offset for signed numbers. */
export const SignedOffset = 48;
