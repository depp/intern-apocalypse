/**
 * Player control.
 */

import { Button, buttonAxis } from './input';

const playerSpeed = 0.02;

/**
 * Current 2D position of the player.
 */
export const playerPos: number[] = [0, 0];

/**
 * Update the state of the player.
 */
export function updatePlayer(): void {
  playerPos[0] += buttonAxis(Button.Left, Button.Right) * playerSpeed;
  playerPos[1] += buttonAxis(Button.Backward, Button.Forward) * playerSpeed;
}
