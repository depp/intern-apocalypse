import { WorkerRequest, WorkerResponse } from './interface.debug';
import { AssertionError } from '../debug/debug';
import { runProgram } from '../synth/engine';
import { firstMusicTrack } from '../audio/sounds';
import { renderScore } from '../score/score';

const audio: (Uint8Array | null)[] = [];

function sendResponse(msg: WorkerResponse): void {
  // @ts-ignore
  postMessage(msg);
}

function renderAudio(index: number): Float32Array | null {
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

function renderChangedAudio(): void {
  for (const index of soundsChanged) {
    soundsChanged.delete(index);
    const code = audio[index];
    let data: Float32Array | null = null;
    let length = 0;
    if (code) {
      try {
        if (index < firstMusicTrack) {
          data = runProgram(code);
        } else {
          [data, length] = renderScore(code, audio);
        }
      } catch (e) {
        console.error(`Could not render audio asset ${index}:`, e);
      }
    }
    sendResponse({ kind: 'audio-result', index, data, length });
    if (code && soundsChanged.size != 0) {
      setTimeout(renderChangedAudio);
    }
  }
}

onmessage = function messageHandler(evt: MessageEvent) {
  const msg = evt.data as WorkerRequest;
  switch (msg.kind) {
    case 'audio-program':
      audio[msg.index] = msg.data;
      if (soundsChanged.size == 0) {
        setTimeout(renderChangedAudio, 100);
      }
      soundsChanged.add(msg.index);
      break;
    case 'set-music':
      break;
    default:
      throw new AssertionError('unknown message kind');
  }
};
