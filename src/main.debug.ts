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
import { initialize, main, newGame } from './main';
import { watchSounds } from './debug/audio';
import { runModelView } from './debug/modelview';
import { initRenderer } from './render/render';
import { debugView } from './lib/settings';
import { startAudio } from './audio/audio';
import { resetTime } from './game/time';

let counter = 0;
let lastFrameMS = 0;
let adjTimeMS = 0;

/**
 * Main update loop for debug builds.
 *
 * @param curTimeMS Current time in milliseconds.
 */
function mainDebug(curTimeMS: DOMHighResTimeStamp): void {
  const { slowDown } = debugView;
  if (slowDown > 1) {
    counter += 1;
    if (counter < debugView.slowDown) {
      requestAnimationFrame(mainDebug);
      return;
    }
    counter -= debugView.slowDown;
    if (lastFrameMS == 0) {
      lastFrameMS = curTimeMS;
    } else {
      adjTimeMS += (curTimeMS - lastFrameMS) / debugView.slowDown;
      lastFrameMS = curTimeMS;
      curTimeMS = adjTimeMS;
    }
  }
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

/** Handle a window event, to start the sound system. */
function firstEvent(): void {
  startAudio();
}

function start(): void {
  resetTime();
  initRenderer();
  watchShaders();
  watchModels();
  watchSounds();
  startDebugGUI();
  if (hashVariables.model != null) {
    runModelView(hashVariables.model);
    return;
  }
  initialize();
  if (hashVariables.game) {
    newGame(hashVariables.difficulty);
  }
  window.addEventListener('click', firstEvent, { once: true, passive: true });
  window.addEventListener('keydown', firstEvent, { once: true, passive: true });
  requestAnimationFrame(mainDebug);
}

start();
