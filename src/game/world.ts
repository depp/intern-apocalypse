/**
 * World state.
 */

import { Level, createLevel } from './level';
import { Vector, vector } from '../lib/math';
import { Random } from '../lib/random';

/** Level data for the current level. */
export let level: Level;

(() => {
  const rand = new Random(1234);
  const size = 10;
  const count = 50;
  const cells: Vector[] = [];
  for (let i = 0; i < count; i++) {
    cells.push(vector(rand.range(-size, size), rand.range(-size, size)));
  }
  level = createLevel(size, cells);
  // Lloyd's algorithm / Voronoi relaxation
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < count; i++) {
      cells[i] = level.cells[i].centroid;
    }
    level = createLevel(size, cells);
  }
  for (let i = 0; i < count; i++) {
    const cell = level.cells[i];
    cell.walkable = rand.range() < 0.8;
  }
  level.updateProperties();
})();
