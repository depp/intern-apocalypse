/**
 * World state.
 */

import { LevelBuilder } from './level';
import { Vector } from '../lib/math';
import { Random } from '../lib/random';

/** Level data for the current level. */
export let level: LevelBuilder;

(() => {
  level = new LevelBuilder();
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
  // Lloyd's algorithm / Voronoi relaxation
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < count; i++) {
      cells[i] = level.cells.get(i)!.centroid();
    }
    level = new LevelBuilder();
    level.createLevel(size, cells);
  }
  for (let i = 0; i < count; i++) {
    const cell = level.cells.get(i)!;
    cell.walkable = rand.range() < 0.8;
  }
  level.updateProperties();
})();
