/**
 * World state.
 */

import { createLevel, Cell } from './level';
import { Vector, vector } from '../lib/math';
import { Random } from '../lib/random';
import { newNavigationGraph } from './navigation';
import { packColor } from '../render/util';
import { AssertionError } from '../debug/debug';
import { spawnExit } from './exit';
import { LevelObject } from './campaign';
import { spawnPlayer } from './player';

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

function createForest(): LevelObject {
  // Impassible border size.
  const border = 9;
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
  const level = createLevel(size, centers);
  // We assign each cell to the closest zone, using the navigation code.
  const graph = newNavigationGraph(level);
  graph.update(centers.slice(0, zoneCount));
  const zoneAssignments = graph.targetData;
  const distances = graph.distanceData;
  // Mark cells walkable if they are adjacent to cells from a different zone.
  // While we're doing this, find cells on the border of the map to make into
  // exits.
  const exits: (Cell | undefined)[] = [];
  // Flags for cells close to the border.
  const nearBorderCellFlag = new Uint8Array(cellCount);
  level.cells.forEach(cell => {
    const zone = zoneAssignments[cell.index];
    let onBorder = false;
    const { x, y } = cell.centroid;
    let nearBorder = Math.max(Math.abs(x), Math.abs(y)) > size - border;
    cell.walkable = false;
    for (const edge of cell.edges()) {
      if (!edge.back) {
        onBorder = true;
      } else if (zoneAssignments[edge.back.cell.index] != zone) {
        cell.walkable = true;
      }
    }
    if (!cell.walkable) {
      return;
    }
    if (nearBorder || onBorder) {
      nearBorderCellFlag[cell.index] = 1;
    }
    if (onBorder) {
      const { x, y } = cell.centroid;
      if (x * x > y * y) {
        const whichBorder = 1 - Math.sign(x);
        const other = exits[whichBorder];
        if (!other || other.centroid.y ** 2 > y * y) {
          exits[whichBorder] = cell;
        }
      } else {
        const whichBorder = 2 - Math.sign(y);
        const other = exits[whichBorder];
        if (!other || other.centroid.x ** 2 > x * x) {
          exits[whichBorder] = cell;
        }
      }
    }
  });
  const colors = [
    packColor(1, 0, 0),
    packColor(0, 1, 0),
    packColor(1, 0, 1),
    packColor(0, 1, 1),
  ];
  // Fill in all the cells near the border that are not exits.
  for (let i = 0; i < 4; i++) {
    const fill: Cell[] = [];
    const exit = exits[i];
    if (!exit) {
      throw new AssertionError(`no exit generated for direction ${i}`);
    }
    fill.push(exit);
    exit.color = colors[i];
    while (fill.length) {
      const cell = fill.pop()!;
      if (nearBorderCellFlag[cell.index]) {
        cell.color = colors[i];
        nearBorderCellFlag[cell.index] = 0;
        for (const edge of cell.edges()) {
          if (edge.back) {
            fill.push(edge.back.cell);
          }
        }
      }
    }
  }
  nearBorderCellFlag.forEach((flag, index) => {
    if (flag) {
      level.cells[index].walkable = false;
    }
  });
  level.updateProperties();

  return {
    level,
    spawn() {
      spawnPlayer(vector(0, 0));
      for (const exit of exits) {
        spawnExit(exit!.centroid);
      }
    },
  };
}

const levels: LevelObject[] = [];
const loaders: (() => LevelObject)[] = [createForest];

export function loadLevel(index: number): LevelObject {
  let level = levels[index];
  if (!level) {
    const loader = loaders[index];
    if (!loader) {
      throw new AssertionError('!loader', { index });
    }
    level = loader();
    levels[index] = level;
  }
  return level;
}
