import { Vector, zeroVector } from '../lib/math';
import { ModelInstance, modelInstances, Team } from './entity';
import {
  matrixNew,
  setIdentityMatrix,
  translateMatrix,
  rotateMatrixFromAngle,
  Axis,
} from '../lib/matrix';
import { ModelAsset } from '../model/models';
import { Collider, colliders } from './physics';
import { campaignData, Stage } from './campaign';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';
import { setGameDialogue } from '../lib/global';

export function spawnHouse(pos: Vector, angle: number): void {
  const transform = matrixNew();
  setIdentityMatrix(transform);
  translateMatrix(transform, [pos.x, pos.y]);
  rotateMatrixFromAngle(transform, Axis.Z, angle);
  const house: ModelInstance = {
    model: ModelAsset.House,
    transform,
  };
  modelInstances.push(house);
}

export function spawnPotion(pos: Vector, index: number): void {
  const mask = 1 << index;
  if (campaignData.potions & mask) {
    return;
  }
  const transform = matrixNew();
  setIdentityMatrix(transform);
  translateMatrix(transform, [pos.x, pos.y, 1]);
  const entity: ModelInstance & Collider = {
    model: ModelAsset.Potion,
    transform,
    radius: 0.5,
    pos,
    velocity: zeroVector,
    team: Team.NPC,
    damage() {},
    playerNear() {
      playSound(Sounds.Interact);
      const flags = (campaignData.potions |= mask);
      const count = (flags & 1) + (flags >> 2) + ((flags >> 1) & 1);
      setGameDialogue(
        [
          'Found a potion! But one is surely not enough…',
          'Another potion! I should get one more just to be safe.',
          'Three potions? I hope it’s enough.',
        ][count - 1],
      );
      if (count == 3) {
        campaignData.stage = Stage.ReturnDungeon;
      }
      this.isDead = true;
    },
  };
  modelInstances.push(entity);
  colliders.push(entity);
}
