/**
 * Player control.
 */

import { Button, buttonAxis } from '../lib/input';
import {
  Vector,
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

/**
 * Current 2D position of the player.
 */
export let playerPos: Vector = { x: 0, y: 0 };

/** Spawn the player in the level. */
export function spawnPlayer(): void {
  const transform = matrixNew();
  const model: ModelInstance = {
    model: ModelAsset.Person,
    transform,
  };
  let angle = 0;
  modelInstances.push(model);
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
      playerPos = walk(playerPos, scaleVector(walkVector, distance));
      if (magSquared) {
        const targetAngle = Math.atan2(walkVector.y, walkVector.x);
        let deltaAngle = canonicalAngle(targetAngle - angle);
        const turnAmount = playerSettings.turnSpeed * frameDT;
        deltaAngle = clamp(deltaAngle, -turnAmount, turnAmount);
        angle = canonicalAngle(angle + deltaAngle);
      }
      identityMatrix(transform);
      translateMatrix(transform, [playerPos.x, playerPos.y]);
      rotateMatrixFromAngle(transform, Axis.Z, angle + 0.5 * Math.PI);
      rotateMatrixFromDirection(transform, Axis.X, 0, 1);
    },
  });
}
