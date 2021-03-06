/**
 * World state.
 */

import { createLevel, Cell } from './level';
import { Vector, vector, linfinityNorm, zeroVector } from '../lib/math';
import { Random } from '../lib/random';
import { newNavigationGraph } from './navigation';
import { AssertionError, isDebug } from '../debug/debug';
import {
  LevelObject,
  entranceDirection,
  campaignData,
  Stage,
} from './campaign';
import { spawnPlayer } from './player';
import * as genmodel from '../model/genmodel';
import { MusicTracks } from '../audio/sounds';
import { playMusic } from '../audio/audio';
import { spawnNPC } from './npc';
import { spawnMonster } from './monster';
import { spawnHouse, spawnPotion } from './prop';
import { setGameDialogue } from '../lib/global';
import { packColor } from '../render/util';
import { setCameraTarget } from './camera';

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
  zones: string;
  monsters: number;
  spawn(zones: Vector[]): void;
}

const enum CellCodes {
  Floor = 'f',
  Rock = 'r',
  Hole = 'h',
  ExitCandidate = 'c',
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
  const zones = centers.slice(0, zoneCount);
  graph.update(zones);
  const zoneAssignments = graph.targetData;
  const distances = graph.distanceData;
  // Mark cells walkable if they are adjacent to cells from a different zone.
  // While we're doing this, find cells on the border of the map to make into
  // exits.
  const exits: (Cell | undefined)[] = [];
  let cellCodes: CellCodes[] = [];
  level.cells.forEach((cell, index) => {
    const zone = zoneAssignments[cell.index];
    let cellCode =
      (spec.zones[zone] as CellCodes | undefined) || CellCodes.Rock;
    let onBorder = false;
    let nearBorder = linfinityNorm(cell.centroid) > size - border;
    let zoneBoundary = false;
    for (const edge of cell.edges()) {
      if (!edge.back) {
        onBorder = true;
      } else if (zoneAssignments[edge.back.cell.index] != zone) {
        zoneBoundary = true;
      }
    }
    if (zoneBoundary) {
      cellCode = CellCodes.Floor;
      if (onBorder || nearBorder) {
        cellCode = CellCodes.ExitCandidate;
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
    }
    cellCodes[index] = cellCode;
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
    while (fill.length) {
      const cell = fill.pop()!;
      if (
        !exitLocs[i] &&
        cell.walkable &&
        linfinityNorm(cell.centroid) < size - 6
      ) {
        exitLocs[i] = cell.centroid;
      }
      if (cellCodes[cell.index] == CellCodes.ExitCandidate) {
        cellCodes[cell.index] = CellCodes.Floor;
        for (const edge of cell.edges()) {
          if (edge.back) {
            fill.push(edge.back.cell);
          }
        }
      }
    }
  }
  const zoneColors = zones.map(() => [rand.range(0.1, 0.2)]);
  level.cells.forEach((cell, index) => {
    const cellCode = cellCodes[index];
    const distance = distances[index];
    let close = ((distance < 7) as unknown) as number;
    switch (cellCode) {
      case CellCodes.Floor:
        cell.walkable = true;
        cell.height = 0;
        break;
      case CellCodes.Rock:
      case CellCodes.ExitCandidate:
        cell.walkable = false;
        cell.height = 0.7 + close * 2;
        break;
      case CellCodes.Hole:
        cell.walkable = false;
        cell.height = -2 - close * 2;
        break;
      default:
        if (isDebug) {
          debugger;
          throw new AssertionError('bad cell code', { cellCode });
        }
        break;
    }
    let luminance =
      0.2 *
      ((cell.walkable ? 4 : 2 - ((close as unknown) as number)) + rand.range());
    cell.color = packColor(luminance, luminance, luminance);
  });
  level.updateProperties();

  const monsters = level.cells
    .slice(spec.zoneCount)
    .filter(cell => cell.walkable && linfinityNorm(cell.centroid) < size - 10)
    .map(cell => cell.centroid)
    .slice(0, spec.monsters);

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
      setCameraTarget(spawnLoc, true);
      monsters.forEach(spawnMonster);
      spec.spawn(zones);
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
    zones: 'rf',
    monsters: 0,
    spawn(zones: Vector[]) {
      spawnNPC(zones[1], () => {
        if (campaignData.stage == Stage.StartDungeon) {
          setGameDialogue(
            'What? Interns don’t fight monsters. Go back west to town and get us some potions.',
          );
          campaignData.stage = Stage.GoTown;
        } else if (campaignData.stage == Stage.ReturnDungeon) {
          setGameDialogue('Finally! What took you so long?');
        } else {
          setGameDialogue('Do you have my potions yet? Town! To the WEST!');
        }
      });
    },
  },
  // MIDDLE: wilderness
  {
    seed: 99,
    size: 40,
    zoneCount: 16,
    cellSize: 8,
    exits: [0, 3, 2, 4],
    music: MusicTracks.Sylvan,
    zones: '',
    monsters: 5,
    spawn() {
      // 23, -27
      // -5, -25
      // -27, -18
    },
  },
  // LEFT: town
  {
    seed: 77,
    size: 30,
    zoneCount: 9,
    cellSize: 8,
    exits: [1],
    music: MusicTracks.Sylvan,
    zones: 'rrrf',
    monsters: 0,
    spawn(zones: Vector[]) {
      if (campaignData.stage >= Stage.GoTown) {
        spawnNPC(zones[3], () => {
          setGameDialogue('Sorry, the apothecary is up north gathering herbs.');
          campaignData.stage = Math.max(campaignData.stage, Stage.GoApothecary);
        });
      }
      spawnHouse(vector(3, 8), 1.8);
      spawnHouse(vector(-4, 2), 2.7);
      spawnHouse(vector(-1, -10), 1);
      spawnHouse(vector(10, -10), 2);
    },
  },
  // TOP: wilderness
  {
    seed: 66,
    size: 40,
    zoneCount: 16,
    cellSize: 8,
    exits: [, , , 1],
    music: MusicTracks.Sylvan,
    zones: 'rrrhrrrrf',
    monsters: 6,
    spawn(zones: Vector[]) {
      const center = zones[8];
      for (let i = 0; i < 4; i++) {
        const x = 2 * (i & 1) - 1;
        const y = (i & 2) - 1;
        spawnMonster(vector(center.x + x, center.y + y));
      }
      if (campaignData.stage >= Stage.GoApothecary) {
        spawnNPC(vector(27, 25), () => {
          setGameDialogue(
            'I think I dropped my potions when I was in the area to the south.',
          );
        });
        campaignData.stage = Math.max(campaignData.stage, Stage.GoPotions);
      }
    },
  },
  // BOTTOM: wilderness
  {
    seed: 55,
    size: 40,
    zoneCount: 16,
    cellSize: 8,
    exits: [, 1],
    music: MusicTracks.Sylvan,
    zones: 'rfrrf',
    monsters: 15,
    spawn() {
      if (campaignData.stage == Stage.GoPotions) {
        spawnPotion(vector(23, -27), 0);
        spawnPotion(vector(-6, -25), 1);
        spawnPotion(vector(-27, -25), 2);
      }
    },
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
