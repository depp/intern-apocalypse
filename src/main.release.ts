/**
 * Entry point for release builds.
 */
import { initialize, main } from './main';
import { loadShaders } from './render/shaders';
import { loadModels } from './model/model';
import { initRenderer } from './render/render';
import { soundOffset } from './lib/loader';
import { decode } from './lib/data.encode';
import { isCompetition } from './debug/debug';
import { WorkerRequest, WorkerResponse } from './worker/interface.release';
import { setAudioRelease, readyAudio } from './audio/audio';
import { setState, State } from './lib/global';

/**
 * Main update loop for debug builds.
 *
 * @param curTimeMS Current time in milliseconds.
 */
function mainRelease(curTimeMS: DOMHighResTimeStamp): void {
  main(curTimeMS);
  requestAnimationFrame(mainRelease);
}

/** Start the game, once we have the bundled data. */
function startWithData(data: readonly string[], workerURL: string): void {
  initRenderer();
  loadShaders(data);
  loadModels(data);
  initialize();
  requestAnimationFrame(mainRelease);
  // The audio take a while to render, so we do it in a background worker.
  const worker = new Worker(workerURL);
  worker.addEventListener('message', evt => {
    const resp = evt.data as WorkerResponse;
    setAudioRelease(resp);
    readyAudio();
    setState(State.MainMenu);
  });
  const req: WorkerRequest = data[soundOffset].split(' ').map(decode);
  worker.postMessage(req);
}

function start(): void {
  // Load bundled data files.
  if (isCompetition) {
    // For the competition, we bundle data in the script tag in the HTML. It is
    // probably less efficient than embedding in the JS, but I like it this way.
    // We must get a blob URL for the worker script.
    const [workerSource, dataSource] = ['w', 'd'].map(id => {
      const scriptElement = document.getElementById(id) as HTMLScriptElement;
      return scriptElement.text;
    });
    const data = JSON.parse(dataSource);
    const blob = new Blob([workerSource]);
    const workerURL = URL.createObjectURL(blob);
    startWithData(data, workerURL);
  } else {
    // For release builds, the data and worker scripts are both bundled as
    // separate files.
    (async () => {
      const response = await fetch(new Request('data.json'));
      const data = await response.json();
      if (!Array.isArray(data) || data.some(x => typeof x != 'string')) {
        throw new Error('unexpected data');
      }
      startWithData(data, 'worker.js');
    })();
  }
}

start();
