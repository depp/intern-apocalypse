/**
 * Entry point for debug builds.
 */

import { parseHash, hashVariables } from './debug/hash';

// Do this *very* first, so other modules can use variables defined in the hash.
parseHash();

import { openWebSocket } from './debug/socket';

// Do this first, before any other modules get initialized (they might throw).
openWebSocket();

import { startDebugGUI } from './debug/controls';
import { watchModels } from './debug/model';
import { renderDebug } from './debug/render';
import { watchShaders } from './debug/shader';
import { gl } from './lib/global';
import { initialize, main } from './main';
import { watchSounds } from './debug/audio';
import { runModelView } from './debug/modelview';

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

function start(): void {
  if (!gl) {
    return;
  }
  watchShaders();
  watchModels();
  watchSounds();
  startDebugGUI();
  const model = hashVariables.get('model');
  if (model != null) {
    runModelView(model);
    return;
  }
  initialize();
  requestAnimationFrame(mainDebug);
}

start();
