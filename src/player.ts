/**
 * Player control.
 */

import { Button, buttonAxis } from './input';
import { Vector } from './math';
import { frameDT } from './time';
import { walk } from './walk';

const playerSpeed = 1.0;

/**
 * Current 2D position of the player.
 */
export let playerPos: Vector = { x: 0, y: 0 };

/**
 * Update the state of the player.
 */
export function updatePlayer(): void {
  playerPos = walk(playerPos, {
    x: buttonAxis(Button.Left, Button.Right) * playerSpeed * frameDT,
    y: buttonAxis(Button.Backward, Button.Forward) * playerSpeed * frameDT,
  });
}
