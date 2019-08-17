/**
 * Game entry point.
 *
 * Execution of the game starts here, and all other functions are called from
 * this file.
 */

import { gl } from './global';
import { render } from './render';

/**
 * Main update loop. Called by requestAnimationFrame, and calls
 * requestAnimationFrame itself. Except for initialization, all other functions
 * are called from here.
 *
 * @param curTimeMS Current time in milliseconds.
 */
function main(curTimeMS: number): void {
  render(curTimeMS);
  requestAnimationFrame(main);
}

if (gl) {
  requestAnimationFrame(main);
}
