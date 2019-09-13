/**
 * World state.
 */

import { createLevel, Cell } from './level';
import { Vector, vector, linfinityNorm, zeroVector } from '../lib/math';
import { Random } from '../lib/random';
import { newNavigationGraph } from './navigation';
import { AssertionError } from '../debug/debug';
import { LevelObject, entranceDirection } from './campaign';
import { spawnPlayer } from './player';
import * as genmodel from '../model/genmodel';
import { MusicTracks } from '../audio/sounds';
import { playMusic } from '../audio/audio';

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

interface LevelSpec {
  seed: number;
  size: number;
  zoneCount: number;
  cellSize: number;
  exits: (number | undefined)[];
  music: MusicTracks;
  spawn(): void;
}

function createWorldLevel(spec: LevelSpec): LevelObject {
  rand.state = spec.seed;
  // Impassible border size.
  const border = 9;
  // Divide the level up into "zones". Place the zones using Voronoi relaxation,
  // then fill in the rest of the level.
  const { size, zoneCount, cellSize } = spec;
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
    let nearBorder = linfinityNorm(cell.centroid) > size - border;
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
  // Fill in all the cells near the border that are not exits. Also calculate
  // exit locations.
  const exitLocs: (Vector | undefined)[] = [];
  for (let i = 0; i < 4; i++) {
    if (spec.exits[i] == null) {
      continue;
    }
    const fill: Cell[] = [];
    const exit = exits[i];
    if (!exit) {
      throw new AssertionError(`no exit generated for direction ${i}`);
    }
    fill.push(exit);
    exit.color = 0xff0000ff;
    while (fill.length) {
      const cell = fill.pop()!;
      if (
        !exitLocs[i] &&
        cell.walkable &&
        linfinityNorm(cell.centroid) < size - 6
      ) {
        exitLocs[i] = cell.centroid;
      }
      if (nearBorderCellFlag[cell.index]) {
        cell.color = 0xff00ff00;
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
    levelModel: genmodel.newModel(),
    level,
    exits: spec.exits,
    spawn() {
      playMusic(spec.music);
      let spawnLoc = zeroVector;
      let angle = -1;
      if (entranceDirection >= 0) {
        spawnLoc = exitLocs[entranceDirection] || spawnLoc;
        angle = entranceDirection ^ 2;
      }
      spawnPlayer(spawnLoc, angle * 0.5 * Math.PI);
    },
  };
}

const levels: LevelObject[] = [];
const specs: LevelSpec[] = [
  // RIGHT SIDE: dungeon
  {
    seed: 88,
    size: 30,
    zoneCount: 8,
    cellSize: 12,
    exits: [, , 1],
    music: MusicTracks.Beyond,
    spawn() {},
  },
  // MIDDLE: wilderness
  {
    seed: 99,
    size: 40,
    zoneCount: 16,
    cellSize: 8,
    exits: [0, 3, 2, 4],
    music: MusicTracks.Sylvan,
    spawn() {},
  },
  // LEFT: town
  {
    seed: 77,
    size: 30,
    zoneCount: 9,
    cellSize: 8,
    exits: [1],
    music: MusicTracks.Sylvan,
    spawn() {},
  },
  // TOP: wilderness
  {
    seed: 66,
    size: 40,
    zoneCount: 16,
    cellSize: 8,
    exits: [, , , 1],
    music: MusicTracks.Sylvan,
    spawn() {},
  },
  // BOTTOM: wilderness
  {
    seed: 55,
    size: 40,
    zoneCount: 16,
    cellSize: 8,
    exits: [, 1],
    music: MusicTracks.Sylvan,
    spawn() {},
  },
];

export function loadLevel(index: number): LevelObject {
  let level = levels[index];
  if (!level) {
    const spec = specs[index];
    if (!spec) {
      throw new AssertionError('!spec', { index });
    }
    level = createWorldLevel(spec);
    levels[index] = level;
  }
  return level;
}
