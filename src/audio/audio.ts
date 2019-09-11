/**
 * Game audio subsystem.
 */

import { runProgram, sampleRate } from '../synth/engine';
import { AssertionError } from '../debug/debug';
import { bundledData } from '../lib/global';
import { soundOffset } from '../lib/loader';
import { decode } from '../lib/data.encode';

export let sounds: (Uint8Array | null)[] = [];
const buffers: AudioBuffer[] = [];

let audioCtx: AudioContext | undefined | false;

/** Get the buffer containing the given sound. */
function getSoundBuffer(index: number): AudioBuffer | null {
  if (!audioCtx) {
    throw new AssertionError('audioCtx == null');
  }
  let buffer = buffers[index];
  if (!buffer) {
    const code = sounds[index];
    if (!code) {
      return null;
    }
    const audio = runProgram(code);
    buffer = audioCtx.createBuffer(1, audio.length, sampleRate);
    buffer.getChannelData(0).set(audio);
    buffers[index] = buffer;
  }
  return buffer;
}

/** Play a sound with the given buffer. */
function playBuffer(buffer: AudioBuffer): void {
  if (!audioCtx) {
    throw new AssertionError('audioCtx == null');
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
}

/** Play the sound with the given index. */
export function playSound(index: number): void {
  if (!audioCtx) {
    return;
  }
  const buffer = getSoundBuffer(index);
  if (!buffer) {
    return;
  }
  playBuffer(buffer);
}

/**
 * Start the audio subsystem.
 */
export function startAudio(): void {
  if (audioCtx != null) {
    return;
  }
  try {
    audioCtx = new ((window as any).AudioContext ||
      (window as any).webkitAudioContext)() as AudioContext;
  } catch (e) {
    console.error(e);
    audioCtx = false;
    return;
  }
  // Play silence. This lets us use the context.
  const buffer = audioCtx.createBuffer(1, 1000, sampleRate);
  playBuffer(buffer);
}

/** Load the sound data files. */
export function loadSounds(): void {
  sounds = bundledData[soundOffset].split(' ').map(decode);
}
