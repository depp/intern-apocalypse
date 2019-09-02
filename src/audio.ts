/**
 * Game audio subsystem.
 */

import { runProgram, sampleRate } from './synth/engine';
import { decode } from './data.encode';

let audioCtx: AudioContext | undefined | false;

const code = '#I/$%)+},h!*0&X),Q}-f,QO*.(';

function startContext(): void {
  if (audioCtx == null) {
    try {
      // @ts-ignore
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.error(e);
      audioCtx = false;
    }
  }
}

function canvasClick(): void {
  startContext();
  if (!audioCtx) {
    return;
  }
  const audio = runProgram(decode(code));
  const buffer = audioCtx.createBuffer(1, audio.length, sampleRate);
  // copyToChannel not available on Safari
  buffer.getChannelData(0).set(audio);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx!.destination);
  source.start();
}

/**
 * Start the audio subsystem.
 */
export function startAudio() {
  window.addEventListener('click', canvasClick);
}
