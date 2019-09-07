/**
 * Game audio subsystem.
 */

import { runProgram, sampleRate } from '../synth/engine';
import { Sounds } from './sounds';
import { AssertionError } from '../debug/debug';
import { bundledData } from '../lib/global';
import { soundOffset } from '../lib/loader';
import { decode } from '../lib/data.encode';

export let sounds: (Uint8Array | null)[] = [];
const buffers: AudioBuffer[] = [];

let audioCtx: AudioContext | undefined | false;

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

/** Play the sound with the given index. */
export function playSound(index: number): void {
  if (!audioCtx) {
    return;
  }
  const buffer = getSoundBuffer(index);
  if (!buffer) {
    return;
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
}

function canvasClick(): void {
  startContext();
  if (!audioCtx) {
    return;
  }
  playSound(Sounds.Clang);
}

/**
 * Start the audio subsystem.
 */
export function startAudio(): void {
  startContext();
  playSound(Sounds.Clang);
}

/** Load the sound data files. */
export function loadSounds(): void {
  sounds = bundledData[soundOffset].split(' ').map(decode);
}
