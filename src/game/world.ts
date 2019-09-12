/**
 * World state.
 */

import { Level, createLevel } from './level';
import { Vector, vector } from '../lib/math';
import { Random } from '../lib/random';
import { newNavigationGraph } from './navigation';

/** Level data for the current level. */
export let level: Level;
/** Incremented each time the level changes. */
export let levelVersion: number = 0;

const rand = new Random();

function randomVector(size: number): Vector {
  return vector(rand.range(-size, size), rand.range(-size, size));
}

function randomVectors(size: number, count: number): Vector[] {
  const result: Vector[] = [];
  for (let i = 0; i < count; i++) {
    result.push(randomVector(size));
  }
  return result;
}

/* Lloyd's algorithm / Voronoi relaxation. */
function relax(count: number, size: number, centers: Vector[]): Vector[] {
  for (let i = 0; i < count; i++) {
    const graph = createLevel(size, centers);
    centers = graph.cells.map(c => c.centroid);
  }
  return centers;
}

function createEmptyLevel(size: number, density: number): void {
  levelVersion++;
  const count = (density * size ** 2) | 0;
  const cells: Vector[] = [];
  for (let i = 0; i < count; i++) {
    const vec = randomVector(size);
    cells.push(vec);
  }
  level = createLevel(size, cells);

  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < count; i++) {
      cells[i] = level.cells[i].centroid;
    }
    level = createLevel(size, cells);
  }
}

export function createBaseLevel(): void {
  rand.state = 1234;
  createEmptyLevel(10, 0.5);
  for (const cell of level.cells) {
    cell.walkable = rand.range() < 0.8;
  }
  level.updateProperties();
}

export function createForest(): void {
  // Divide the level up into "zones". Place the zones using Voronoi relaxation,
  // then fill in the rest of the level.
  const size = 40;
  const zoneCount = 16;
  const cellSize = 8;
  const cellCount = ((size * size * 4) / cellSize) | 0;
  const centers = relax(
    1,
    size,
    relax(2, size, randomVectors(size, zoneCount)).concat(
      randomVectors(size, cellCount - zoneCount),
    ),
  );
  levelVersion++;
  level = createLevel(size, centers);
  // We assign each cell to the closest zone, using the navigation code.
  const graph = newNavigationGraph(level);
  graph.update(centers.slice(0, zoneCount));
  const zoneAssignments = graph.targetData;
  const distances = graph.distanceData;
  for (let i = 0; i < cellCount; i++) {
    const cell = level.cells[i];
    cell.walkable = false;
    const zone = zoneAssignments[cell.index];
    for (const edge of cell.edges()) {
      if (edge.back && zoneAssignments[edge.back.cell.index] != zone) {
        cell.walkable = true;
      }
    }
    cell.height = -distances[i] * 0.2;
  }
  level.updateProperties();
}
