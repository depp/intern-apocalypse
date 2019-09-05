/**
 * Main game loop and initialization.
 */

import { startAudio } from './audio/audio';
import { updateCamera } from './game/camera';
import { startInput, endFrameInput } from './lib/input';
import { spawnPlayer } from './game/player';
import { render } from './render/render';
import { updateTime } from './game/time';
import { updateWorld } from './game/world';

/**
 * Initialize game.
 */
export function initialize(): void {
  startInput();
  startAudio();
  spawnPlayer();
}

/**
 * Main update loop.
 *
 * @param curTimeMS Current time in milliseconds.
 */
export function main(curTimeMS: DOMHighResTimeStamp): void {
  updateTime(curTimeMS);
  updateWorld();
  updateCamera();
  endFrameInput();
  render();
}
