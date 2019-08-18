/**
 * Game entry point.
 *
 * Execution of the game starts here, and all other functions are called from
 * this file.
 */

import { gl } from './global';
import { startInput, endFrameInput } from './input';
import { updatePlayer } from './player';
import { render } from './render';
import { renderDebug } from './render_debug';
import { updateTime } from './time';

/**
 * Main update loop. Called by requestAnimationFrame, and calls
 * requestAnimationFrame itself. Except for initialization, all other functions
 * are called from here.
 *
 * @param curTimeMS Current time in milliseconds.
 */
function main(curTimeMS: DOMHighResTimeStamp): void {
  updateTime(curTimeMS);
  updatePlayer();
  endFrameInput();
  render(curTimeMS);
  renderDebug();
  requestAnimationFrame(main);
}

if (gl) {
  startInput();
  requestAnimationFrame(main);
}
