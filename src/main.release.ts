/**
 * Entry point for release builds.
 */
import { initialize, main } from './main';
import { loadShaders } from './render/shaders';
import { loadModels } from './model/model';
import { loadBundledData, bundledData } from './lib/global';
import { initRenderer } from './render/render';
import { soundOffset } from './lib/loader';
import { decode } from './lib/data.encode';
import { isCompetition } from './debug/debug';
import { WorkerRequest, WorkerResponse } from './worker/interface.release';
import { setSound, setMusic } from './audio/audio';

/**
 * Main update loop for debug builds.
 *
 * @param curTimeMS Current time in milliseconds.
 */
function mainRelease(curTimeMS: DOMHighResTimeStamp): void {
  main(curTimeMS);
  requestAnimationFrame(mainRelease);
}

/** Load the sound data files. */
function loadSounds(): void {
  const soundData = bundledData[soundOffset].split(' ').map(decode);
  const musicData = bundledData[soundOffset + 1].split(' ').map(decode);
  let url: string;
  if (isCompetition) {
    const scriptElement = document.getElementById('w') as HTMLScriptElement;
    const source = scriptElement.text;
    const blob = new Blob([source]);
    url = URL.createObjectURL(blob);
  } else {
    url = 'worker.js';
  }
  const worker = new Worker(url);
  worker.addEventListener('message', evt => {
    const resp = evt.data as WorkerResponse;
    resp[0].forEach((data, index) => setSound(index, data));
    resp[1].forEach((data, index) => setMusic(index, data));
  });
  const req: WorkerRequest = [soundData, musicData];
  worker.postMessage(req);
}

async function start(): Promise<void> {
  await loadBundledData();
  loadSounds();
  initRenderer();
  loadShaders();
  loadModels();
  initialize();
  requestAnimationFrame(mainRelease);
}

start();
