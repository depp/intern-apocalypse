/* This code is automatically generated. */

/** Sound asset identifiers. */
export const enum Sounds {
  Bass,
  Clang,
  Harp,
  MonsterDeath,
  MonsterHit,
  Sweep,
  Swoosh,
}

/** Get list of sound filenames, in order. */
export function getSoundNames(): string[] {
  return [
    'audio/bass.lisp',
    'audio/clang.lisp',
    'audio/harp.lisp',
    'audio/monster_death.lisp',
    'audio/monster_hit.lisp',
    'audio/sweep.lisp',
    'audio/swoosh.lisp',
  ];
}

/** Music track asset identifiers. */
export const enum MusicTracks {
  Sylvan,
}

/** Get list of music score filenames, in order. */
export function getMusicNames(): string[] {
  return ['music/sylvan.txt'];
}
