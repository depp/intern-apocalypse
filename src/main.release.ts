/**
 * Entry point for release builds.
 */
import { initialize, main } from './main';
import { loadShaders } from './render/shaders';
import { loadSounds } from './audio/audio';
import { loadModels } from './model/model';
import { loadBundledData } from './lib/global';
import { initRenderer } from './render/render';

/**
 * Main update loop for debug builds.
 *
 * @param curTimeMS Current time in milliseconds.
 */
function mainRelease(curTimeMS: DOMHighResTimeStamp): void {
  main(curTimeMS);
  requestAnimationFrame(mainRelease);
}

async function start(): Promise<void> {
  await loadBundledData();
  initRenderer();
  loadShaders();
  loadSounds();
  loadModels();
  initialize();
  requestAnimationFrame(mainRelease);
}

start();
