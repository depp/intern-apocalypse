/** Game difficulty settings. */
export const enum Difficulty {
  Easy,
  Normal,
  Hard,
}

/** The current game difficulty level. */
export let gameDifficulty!: Difficulty;

/** Set the current game difficulty level. */
export function setDifficulty(difficulty: Difficulty): void {
  gameDifficulty = difficulty;
}
