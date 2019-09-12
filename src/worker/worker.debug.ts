import { WorkerRequest, WorkerResponse } from './interface.debug';
import { AssertionError } from '../debug/debug';
import { runProgram } from '../synth/engine';

const audio: (Uint8Array | null)[] = [];
const music: (Uint8Array | null)[] = [];

function sendResponse(msg: WorkerResponse): void {
  // @ts-ignore
  postMessage(msg);
}

function renderSound(index: number): Float32Array | null {
  try {
    const code = audio[index];
    if (!code) {
      return null;
    }
    return runProgram(code);
  } catch (e) {
    console.error(e);
    return null;
  }
}

const soundsChanged = new Set<number>();

function renderSounds(): void {
  const changed = Array.from(soundsChanged);
  soundsChanged.clear();
  for (const index of changed) {
    const data = renderSound(index);
    sendResponse({
      kind: 'sound-result',
      index,
      data,
    });
  }
}

onmessage = function messageHandler(evt: MessageEvent) {
  const msg = evt.data as WorkerRequest;
  switch (msg.kind) {
    case 'sound-program':
      audio[msg.index] = msg.data;
      if (soundsChanged.size == 0) {
        setTimeout(renderSounds, 100);
      }
      soundsChanged.add(msg.index);
      break;
    case 'music-program':
      music[msg.index] = msg.data;
      break;
    case 'render-music':
      break;
    default:
      throw new AssertionError('unknown message kind');
  }
};
