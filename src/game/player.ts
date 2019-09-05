/**
 * Player control.
 */

import { Button, buttonAxis } from '../lib/input';
import { Vector, vector, lengthSquared, scaleVector } from '../lib/math';
import { frameDT } from './time';
import { walk } from './walk';
import { entities } from './world';
import { ModelInstance, modelInstances } from './model';
import { ModelAsset } from '../model/models';
import { playerSettings } from '../debug/controls';

/**
 * Current 2D position of the player.
 */
export let playerPos: Vector = { x: 0, y: 0 };

/** Spawn the player in the level. */
export function spawnPlayer(): void {
  const pos = new Float32Array(3);
  const model: ModelInstance = {
    model: ModelAsset.Person,
    pos,
    angle: 0,
  };
  pos[2] = 0;
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
      pos[0] = playerPos.x;
      pos[1] = playerPos.y;
      if (magSquared) {
        model.angle = Math.atan2(walkVector.y, walkVector.x);
      }
    },
  });
}
