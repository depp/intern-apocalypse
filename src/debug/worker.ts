import { WorkerRequest, WorkerResponse } from '../worker/interface.debug';
import { setSound, setMusic } from '../audio/audio';

let worker: Worker | null = null;

/** Send a message to the worker. */
export function sendMessage(msg: WorkerRequest): void {
  if (worker == null) {
    console.error('No worker');
    return;
  }
  worker.postMessage(msg);
}

function handleMessage(evt: MessageEvent): void {
  const msg = evt.data as WorkerResponse;
  switch (msg.kind) {
    case 'sound-result':
      setSound(msg.index, msg.data);
      break;
    case 'music-result':
      setMusic(msg.index, msg.data);
      break;
  }
}

/** Start the background worker. */
export function startWorker(): void {
  worker = new Worker('worker.js');
  worker.addEventListener('message', handleMessage);
}
