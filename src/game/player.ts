/**
 * Player control.
 */

import { Button, buttonAxis, buttonPress } from '../lib/input';
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
  setIdentityMatrix,
  translateMatrix,
  Axis,
  rotateMatrixFromAngle,
  rotateMatrixFromDirection,
} from '../lib/matrix';
import { setCameraTarget } from './camera';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';

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

  // Amount of time into attack.
  let attackTime = -1;

  entities.push({
    update() {
      if (attackTime >= 0) {
        attackTime += frameDT;
        if (attackTime > playerSettings.attackTime) {
          attackTime = -1;
        }
      } else if (buttonPress[Button.Action]) {
        attackTime = 0;
        playSound(Sounds.Swoosh);
      }

      // Update player position.
      let walkVector = vector(
        buttonAxis(Button.Left, Button.Right),
        buttonAxis(Button.Backward, Button.Forward),
      );
      const magSquared = lengthSquared(walkVector);
      if (magSquared > 1) {
        // Maximum speed the same in all directions (no diagonal speed boost).
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

      // Update camera position.
      setCameraTarget(pos);

      // Set player model transform.
      setIdentityMatrix(transform);
      translateMatrix(transform, [pos.x, pos.y]);
      rotateMatrixFromAngle(transform, Axis.Z, angle + 0.5 * Math.PI);
      rotateMatrixFromDirection(transform, Axis.X, 0, 1);

      // Set sword model transform.
      swordTransform.set(transform);
      let frac = -1;
      let blend = 0;
      if (attackTime >= 0) {
        frac = 2 * (attackTime / playerSettings.attackTime) - 1;
        blend = Math.min(2 * (1 - Math.abs(frac)), 1);
      }
      translateMatrix(swordTransform, [-0.4, 0.5, 0.5 - 0.5 * Math.abs(frac)]);
      rotateMatrixFromDirection(swordTransform, Axis.X, 1 - blend, 1);
      rotateMatrixFromDirection(
        swordTransform,
        Axis.Z,
        1 - blend * Math.abs(frac),
        -2 * blend * frac,
      );
      rotateMatrixFromDirection(swordTransform, Axis.Y, 1, 1 - blend);
    },
  });
}
