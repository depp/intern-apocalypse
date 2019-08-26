/**
 * Entry point for release builds.
 */
import { gl } from './global';
import { initialize, main } from './main';

/**
 * Main update loop for debug builds.
 *
 * @param curTimeMS Current time in milliseconds.
 */
function mainRelease(curTimeMS: DOMHighResTimeStamp): void {
  main(curTimeMS);
  requestAnimationFrame(mainRelease);
}

if (gl) {
  initialize();
  requestAnimationFrame(mainRelease);
}
