/**
 * Player control.
 */

import { Button, buttonAxis } from './input';
import { Vector } from './math';
import { frameDT } from './time';

const playerSpeed = 1.0;

/**
 * Current 2D position of the player.
 */
export const playerPos: Vector = { x: 0, y: 0 };

/**
 * Update the state of the player.
 */
export function updatePlayer(): void {
  playerPos.x += buttonAxis(Button.Left, Button.Right) * playerSpeed * frameDT;
  playerPos.y +=
    buttonAxis(Button.Backward, Button.Forward) * playerSpeed * frameDT;
}
