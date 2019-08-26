/**
 * Game audio subsystem.
 */

import { runProgram, sampleRate } from './audio.synth';
import { decode } from './data.encode';

let audioCtx: AudioContext | undefined;

const code = '!R(*"#!!(!~(!}!X!O%"+$!O!E!}!X!}!E!O%$&';

function startContext(): void {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
}

function canvasClick(): void {
  startContext();
  const audio = runProgram(decode(code));
  const buffer = audioCtx!.createBuffer(1, audio.length, sampleRate);
  buffer.copyToChannel(audio, 0);
  const source = audioCtx!.createBufferSource();
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
