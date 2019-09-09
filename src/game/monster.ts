import {
  Vector,
  scaleVector,
  normalizeSubtract,
  zeroVector,
  distanceSquared,
} from '../lib/math';
import { ModelAsset } from '../model/models';
import { createWalker, WalkerParameters, Walker } from './walker';
import { ModelInstance, modelInstances, entities, Entity } from './entity';
import { spawnDeath, spawnSlash } from './particles';
import { isDebug } from '../debug/debug';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';
import { level } from './world';
import { Collider, colliders } from './physics';
import { updateNavigation, navigationTarget } from './navigation';

/** Spawn a monster in the level. */
export function spawnMonster(pos: Vector): void {
  const params: WalkerParameters = {
    speed: 4,
    acceleration: 20,
    turnSpeed: 20,
  };
  let health = 2;
  let walker: Walker;
  let model: ModelInstance;
  const entity: Entity & Collider = {
    pos,
    velocity: zeroVector,
    radius: 0.5,
    update() {
      const pos = this.pos;
      let movement = zeroVector;
      if (navigationTarget) {
        let targetDistanceSquared = distanceSquared(pos, navigationTarget);
        if (targetDistanceSquared < 4) {
          movement = normalizeSubtract(navigationTarget, pos);
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
        this.velocity = scaleVector(direction, 12);
      } else {
        spawnDeath(model.transform, model.model);
        playSound(Sounds.MonsterDeath);
        this.isDead = true;
        model.isDead = true;
      }
    },
  };
  walker = createWalker(entity);
  model = {
    model: ModelAsset.Eyestalk,
    transform: walker.transform,
  };
  modelInstances.push(model);
  entities.push(entity);
  colliders.push(entity);
}
