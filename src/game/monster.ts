import { vector, canonicalAngle } from '../lib/math';
import { ModelAsset } from '../model/models';
import { ModelInstance, modelInstances } from './model';
import { createWalker, WalkerParameters } from './walker';
import { entities, Entity, Collider, colliders } from './entity';
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
  const entity: Entity & Collider = {
    pos,
    radius: 0.5,
    update() {
      angle = canonicalAngle(angle + frameDT);
      const movement = vector(Math.sin(angle), Math.cos(angle));
      walker.update(params, movement);
      this.pos = walker.pos;
      if (isDebug) {
        this.debugArrow = vector(Math.sin(angle), Math.cos(angle));
      }
    },
  };
  entities.push(entity);
  colliders.push(entity);
}
