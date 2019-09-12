import { WorkerRequest, WorkerResponse } from '../worker/interface.debug';
import { setAudioDebug } from '../audio/audio';

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
    case 'audio-result':
      setAudioDebug(msg.index, msg.data, msg.length);
      break;
    default:
      console.error('unknown message kind', msg);
      break;
  }
}

/** Start the background worker. */
export function startWorker(): void {
  worker = new Worker('worker.js');
  worker.addEventListener('message', handleMessage);
}
