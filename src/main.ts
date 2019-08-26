/**
 * Main game loop and initialization.
 */

import { startAudio } from './audio';
import { updateCamera } from './camera';
import { startInput, endFrameInput } from './input';
import { updatePlayer } from './player';
import { render } from './render';
import { updateTime } from './time';

/**
 * Initialize game.
 */
export function initialize(): void {
  startInput();
  startAudio();
}

/**
 * Main update loop.
 *
 * @param curTimeMS Current time in milliseconds.
 */
export function main(curTimeMS: DOMHighResTimeStamp): void {
  updateTime(curTimeMS);
  updatePlayer();
  updateCamera();
  endFrameInput();
  render();
}
