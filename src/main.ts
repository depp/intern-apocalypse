/**
 * Main game loop and initialization.
 */

import { startInput, endFrameInput } from './input';
import { updatePlayer } from './player';
import { render } from './render';
import { updateTime } from './time';

/**
 * Initialize game.
 */
export function initialize(): void {
  startInput();
}

/**
 * Main update loop.
 *
 * @param curTimeMS Current time in milliseconds.
 */
export function main(curTimeMS: DOMHighResTimeStamp): void {
  updateTime(curTimeMS);
  updatePlayer();
  endFrameInput();
  render();
}
