/**
 * Entry point for release builds.
 */
import { initialize, main } from './main';
import { loadShaders } from './render/shaders';
import { gl } from './lib/global';

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
  loadShaders();
  initialize();
  requestAnimationFrame(mainRelease);
}
