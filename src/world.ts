/**
 * World state.
 */

import { LevelBuilder } from './level';
import { Vector } from './math';
import { Random } from './random';

/** Level data for the current level. */
export const level = new LevelBuilder();

(() => {
  const rand = new Random(1234);
  const size = 10;
  const count = 50;
  const cells: Vector[] = [];
  for (let i = 0; i < count; i++) {
    cells.push({
      x: rand.range(-size, size),
      y: rand.range(-size, size),
    });
  }
  level.createLevel(size, cells);
})();
