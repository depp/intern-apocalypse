/**
 * Player control.
 */

import { Button, buttonAxis } from '../lib/input';
import {
  vector,
  lengthSquared,
  scaleVector,
  canonicalAngle,
} from '../lib/math';
import { frameDT } from './time';
import { walk } from './walk';
import { entities } from './world';
import { ModelInstance, modelInstances } from './model';
import { ModelAsset } from '../model/models';
import { playerSettings } from '../lib/settings';
import { clamp } from '../lib/util';
import {
  matrixNew,
  identityMatrix,
  translateMatrix,
  Axis,
  rotateMatrixFromAngle,
  rotateMatrixFromDirection,
} from '../lib/matrix';
import { setCameraTarget } from './camera';

/** Spawn the player in the level. */
export function spawnPlayer(): void {
  let pos = vector(0, 0);
  const transform = matrixNew();
  const swordTransform = matrixNew();
  const model: ModelInstance = {
    model: ModelAsset.Person,
    transform,
  };
  const swordModel: ModelInstance = {
    model: ModelAsset.Sword,
    transform: swordTransform,
  };
  let angle = 0;
  modelInstances.push(model, swordModel);
  entities.push({
    update() {
      let walkVector = vector(
        buttonAxis(Button.Left, Button.Right),
        buttonAxis(Button.Backward, Button.Forward),
      );
      const magSquared = lengthSquared(walkVector);
      if (magSquared > 1) {
        walkVector = scaleVector(walkVector, 1 / Math.sqrt(magSquared));
      }
      const distance = playerSettings.speed * frameDT;
      pos = walk(pos, scaleVector(walkVector, distance));
      if (magSquared) {
        const targetAngle = Math.atan2(walkVector.y, walkVector.x);
        let deltaAngle = canonicalAngle(targetAngle - angle);
        const turnAmount = playerSettings.turnSpeed * frameDT;
        deltaAngle = clamp(deltaAngle, -turnAmount, turnAmount);
        angle = canonicalAngle(angle + deltaAngle);
      }
      setCameraTarget(pos);
      identityMatrix(transform);
      translateMatrix(transform, [pos.x, pos.y]);
      rotateMatrixFromAngle(transform, Axis.Z, angle + 0.5 * Math.PI);
      rotateMatrixFromDirection(transform, Axis.X, 0, 1);
      swordTransform.set(transform);
      translateMatrix(swordTransform, [-0.4, 0.5, 0]);
      rotateMatrixFromDirection(swordTransform, Axis.X, 1, 1);
      rotateMatrixFromDirection(swordTransform, Axis.Y, 1, 1);
    },
  });
}
