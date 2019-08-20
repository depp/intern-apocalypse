/**
 * World state.
 */

import { LevelBuilder } from './level';

/** Level data for the current level. */
export const level = new LevelBuilder();

level.createLevel([
  { x: 0, y: 4 },
  { x: 2, y: 0 },
  { x: 0, y: -3 },
  { x: -1, y: 0 },
  { x: 0, y: 0 },
]);
