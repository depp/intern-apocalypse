/**
 * Main game loop and initialization.
 */

import { startAudio } from './audio/audio';
import { updateCamera } from './game/camera';
import { startInput, endFrameInput } from './lib/input';
import { updatePlayer } from './game/player';
import { render } from './render/render';
import { updateTime } from './game/time';

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
