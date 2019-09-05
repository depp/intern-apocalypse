/**
 * Player control.
 */

import { Button, buttonAxis } from '../lib/input';
import { Vector } from '../lib/math';
import { frameDT } from './time';
import { walk } from './walk';
import { entities } from './world';
import { ModelInstance, modelInstances } from './model';
import { ModelAsset } from '../model/models';

/** Player walking speed, in meters per second. */
const playerSpeed = 5.0;

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
  };
  pos[2] = 0;
  modelInstances.push(model);
  entities.push({
    update() {
      playerPos = walk(playerPos, {
        x: buttonAxis(Button.Left, Button.Right) * playerSpeed * frameDT,
        y: buttonAxis(Button.Backward, Button.Forward) * playerSpeed * frameDT,
      });
      pos[0] = playerPos.x;
      pos[1] = playerPos.y;
    },
  });
}
