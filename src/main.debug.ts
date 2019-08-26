/**
 * Entry point for debug builds.
 */
import { startDebugGUI } from './debug.controls';
import { renderDebug } from './debug.render';
import { gl } from './global';
import { initialize, main } from './main';

/**
 * Main update loop for debug builds.
 *
 * @param curTimeMS Current time in milliseconds.
 */
function mainDebug(curTimeMS: DOMHighResTimeStamp): void {
  let failed = false;
  try {
    main(curTimeMS);
  } catch (e) {
    failed = true;
    console.error(e);
  }
  renderDebug();
  if (!failed) {
    requestAnimationFrame(mainDebug);
  }
}

if (gl) {
  startDebugGUI();
  initialize();
  requestAnimationFrame(mainDebug);
}
