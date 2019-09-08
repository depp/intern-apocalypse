import { canonicalAngle, angleVector, Vector, scaleVector } from '../lib/math';
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
import { spawnDeath, spawnSlash } from './particles';
import { isDebug } from '../debug/debug';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';

/** Spawn a monster in the level. */
export function spawnMonster(pos: Readonly<Vector>): void {
  const walker = createWalker(pos);
  const model: ModelInstance = {
    model: ModelAsset.Eyestalk,
    transform: walker.transform,
  };
  modelInstances.push(model);
  let angle = 0;
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
      angle = canonicalAngle(angle + frameDT);
      walker.update(params, angleVector(angle));
      this.pos = walker.pos;
      if (isDebug) {
        this.debugArrow = walker.facing;
      }
    },
    damage(direction: Readonly<Vector>): void {
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
