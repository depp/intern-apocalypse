/**
 * World state.
 */

import { LevelBuilder } from './level';
import { Vector } from './math';

/** Level data for the current level. */
export const level = new LevelBuilder();

(() => {
  const size = 10;
  const count = 50;
  const cells: Vector[] = [];
  for (let i = 0; i < count; i++) {
    cells.push({
      x: Math.random() * (size * 2) - size,
      y: Math.random() * (size * 2) - size,
    });
  }
  level.createLevel(size, cells);
})();
