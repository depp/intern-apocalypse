/**
 * Player control.
 */

import { Button, buttonAxis } from '../lib/input';
import { Vector } from '../lib/math';
import { frameDT } from './time';
import { walk } from './walk';
import { entities } from './world';

/** Player walking speed, in meters per second. */
const playerSpeed = 5.0;

/**
 * Current 2D position of the player.
 */
export let playerPos: Vector = { x: 0, y: 0 };

/** Spawn the player in the level. */
export function spawnPlayer(): void {
  entities.push({
    update() {
      playerPos = walk(playerPos, {
        x: buttonAxis(Button.Left, Button.Right) * playerSpeed * frameDT,
        y: buttonAxis(Button.Backward, Button.Forward) * playerSpeed * frameDT,
      });
    },
  });
}
