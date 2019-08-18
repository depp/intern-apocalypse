/**
 * Player control.
 */

import { Button, buttonAxis } from './input';
import { frameDT } from './time';

const playerSpeed = 1.0;

/**
 * Current 2D position of the player.
 */
export const playerPos: [number, number] = [0, 0];

/**
 * Update the state of the player.
 */
export function updatePlayer(): void {
  playerPos[0] += buttonAxis(Button.Left, Button.Right) * playerSpeed * frameDT;
  playerPos[1] +=
    buttonAxis(Button.Backward, Button.Forward) * playerSpeed * frameDT;
}
