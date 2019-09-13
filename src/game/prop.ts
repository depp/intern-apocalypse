import { Vector, zeroVector } from '../lib/math';
import { ModelInstance, modelInstances, entities, Team } from './entity';
import {
  matrixNew,
  setIdentityMatrix,
  translateMatrix,
  rotateMatrixFromAngle,
  Axis,
} from '../lib/matrix';
import { ModelAsset } from '../model/models';
import { Collider, colliders } from './physics';

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
    playerAction() {
      console.log('GOT POTION');
    },
  };
  modelInstances.push(entity);
  colliders.push(entity);
}
