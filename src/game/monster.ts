import { vector, canonicalAngle, angleVector } from '../lib/math';
import { ModelAsset } from '../model/models';
import { createWalker, WalkerParameters } from './walker';
import {
  ModelInstance,
  modelInstances,
  entities,
  Entity,
  Collider,
  colliders,
} from './entity';
import { frameDT } from './time';
import { isDebug } from '../debug/debug';

/** Spawn a monster in the level. */
export function spawnMonster(): void {
  let pos = vector(-9, -9);
  const walker = createWalker(pos);
  const model: ModelInstance = {
    model: ModelAsset.Eyestalk,
    transform: walker.transform,
  };
  modelInstances.push(model);
  let angle = 0;
  const params: WalkerParameters = {
    speed: 4,
    turnSpeed: 20,
  };
  let health = 2;
  const entity: Entity & Collider = {
    pos,
    radius: 0.5,
    update() {
      angle = canonicalAngle(angle + frameDT);
      walker.update(params, angleVector(angle));
      this.pos = walker.pos;
      if (isDebug) {
        this.debugArrow = walker.facing;
      }
    },
    damage() {
      health--;
      if (health <= 0) {
        this.isDead = true;
        model.isDead = true;
      }
    },
  };
  entities.push(entity);
  colliders.push(entity);
}
