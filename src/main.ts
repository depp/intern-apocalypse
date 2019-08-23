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
import { renderDebug } from './debug.render';
import { updateTime } from './time';

/**
 * Main update loop. Called by requestAnimationFrame, and calls
 * requestAnimationFrame itself. Except for initialization, all other functions
 * are called from here.
 *
 * @param curTimeMS Current time in milliseconds.
 */
function main(curTimeMS: DOMHighResTimeStamp): void {
  let failed = false;
  updateTime(curTimeMS);
  try {
    updatePlayer();
  } catch (e) {
    console.error(e);
    failed = true;
  }
  endFrameInput();
  render();
  renderDebug();
  if (!failed) {
    requestAnimationFrame(main);
  }
}

if (gl) {
  startInput();
  requestAnimationFrame(main);
}
