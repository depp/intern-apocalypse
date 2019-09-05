/* This code is automatically generated. */

/** Sound asset identifiers. */
export const enum Sounds {
  Bass,
  Clang,
  Harp,
  Sweep,
}

/** Loaded sounds. */
export const sounds: (Uint8Array | null)[] = [];

/** Get list of sound filenames, in order. */
export function getSoundNames(): string[] {
  return [
    'audio/bass.lisp',
    'audio/clang.lisp',
    'audio/harp.lisp',
    'audio/sweep.lisp',
  ];
}
