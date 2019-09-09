import {
  Vector,
  scaleVector,
  normalizeSubtract,
  zeroVector,
  distance,
  distanceSquared,
} from '../lib/math';
import { ModelAsset } from '../model/models';
import { createWalker, WalkerParameters } from './walker';
import {
  ModelInstance,
  modelInstances,
  entities,
  Entity,
  Collider,
  colliders,
  monsterTarget,
} from './entity';
import { spawnDeath, spawnSlash } from './particles';
import { isDebug } from '../debug/debug';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';
import { level } from './world';
import { Cell } from './level';
import { levelTime } from './time';

/** Interval, in seconds, between navigation updates. */
const navigationUpdateInterval = 0.5;

/** Level time when navigation graph was last updated.. */
let lastNavigationUpdateTime: number = -1;

/** Update the monster navigation graph if necessary. */
function updateNavigation(): void {
  if (
    levelTime >= lastNavigationUpdateTime &&
    levelTime < lastNavigationUpdateTime + navigationUpdateInterval
  ) {
    return;
  }
  lastNavigationUpdateTime = levelTime;
  for (const cell of level.cells.values()) {
    cell.navigateNext = null;
    cell.navigateDistance = 0;
  }
  if (!monsterTarget) {
    return;
  }
  // Simple breadth-first search...
  const cell = level.findCell(monsterTarget);
  const initialDistance = distance(cell.center, monsterTarget);
  interface Node {
    cell: Cell;
    navigateDistance: number;
    next: Cell;
  }
  // We set the initial cell to point to itself at first, so we can use this
  // field to test if a cell has been visited. It is cleaned up below.
  const frontier: Node[] = [
    { cell, navigateDistance: initialDistance, next: cell },
  ];
  while (frontier.length) {
    let index = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].navigateDistance < frontier[index].navigateDistance) {
        index = i;
      }
    }
    const { cell, navigateDistance, next } = frontier[index];
    frontier[index] = frontier[frontier.length - 1];
    frontier.pop();
    if (!cell.navigateNext) {
      cell.navigateNext = next;
      cell.navigateDistance = navigateDistance;
      for (const edge of cell.edges()) {
        const back = level.edgeBack(edge);
        if (back.passable && back.cell && !back.cell.navigateDistance) {
          frontier.push({
            cell: back.cell,
            navigateDistance:
              navigateDistance + distance(cell.center, back.cell.center),
            next: cell,
          });
        }
      }
    }
  }
  // Clean up the cycle we introduced.
  cell.navigateNext = null;
}

/** Spawn a monster in the level. */
export function spawnMonster(pos: Vector): void {
  const walker = createWalker(pos);
  const model: ModelInstance = {
    model: ModelAsset.Eyestalk,
    transform: walker.transform,
  };
  modelInstances.push(model);
  const params: WalkerParameters = {
    speed: 4,
    acceleration: 20,
    turnSpeed: 20,
  };
  let health = 2;
  const entity: Entity & Collider = {
    pos,
    radius: 0.5,
    update() {
      const pos = this.pos;
      let movement = zeroVector;
      if (monsterTarget) {
        let targetDistanceSquared = distanceSquared(pos, monsterTarget);
        if (targetDistanceSquared < 4) {
          movement = normalizeSubtract(monsterTarget, pos);
        } else {
          updateNavigation();
          const cell = level.findCell(pos);
          const next = cell.navigateNext;
          if (next) {
            movement = normalizeSubtract(next.center, pos);
          }
        }
      }
      walker.update(params, movement);
      this.pos = walker.pos;
      if (isDebug) {
        this.debugArrow = walker.facing;
      }
    },
    damage(direction: Vector): void {
      if (this.isDead) {
        return;
      }
      health--;
      spawnSlash(this.pos, direction);
      if (health > 0) {
        playSound(Sounds.MonsterHit);
        walker.velocity = scaleVector(direction, 12);
      } else {
        spawnDeath(model.transform, model.model);
        playSound(Sounds.MonsterDeath);
        this.isDead = true;
        model.isDead = true;
      }
    },
  };
  entities.push(entity);
  colliders.push(entity);
}
