import { Vector } from '../lib/math';
import { ModelInstance, modelInstances } from './entity';
import {
  matrixNew,
  setIdentityMatrix,
  translateMatrix,
  rotateMatrixFromAngle,
  Axis,
} from '../lib/matrix';
import { ModelAsset } from '../model/models';

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
