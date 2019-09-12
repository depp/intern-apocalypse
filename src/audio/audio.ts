/**
 * Game audio subsystem.
 */

import { sampleRate } from '../lib/audio';
import { AssertionError, isDebug } from '../debug/debug';
import { Sounds, MusicTracks } from './sounds';
import { canvas } from '../lib/global';

let audioCtx: AudioContext | undefined | false;

/** The audio data. Loaded by setAudioDebug and setAudioRelease. */
let audioData: (Float32Array | null)[] | undefined;
/** The audio buffer objects. */
let audioBuffers: (AudioBuffer | null)[] | undefined;

/**
 * Load an audio buffer into the given slot.
 */
export function setAudioDebug(index: number, data: Float32Array | null): void {
  if (!audioData) {
    audioData = [];
  }
  audioData[index] = data;
  if (!audioBuffers) {
    audioBuffers = [];
  }
  audioBuffers[index] = null;
}

/**
 * Load audio buffers into all slots.
 */
export function setAudioRelease(data: (Float32Array | null)[]): void {
  audioData = data;
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
export function playSound(index: Sounds | MusicTracks): void {
  if (!audioCtx) {
    return;
  }
  if (!audioBuffers) {
    throw new AssertionError('audioBuffers == null');
  }
  let buffer = audioBuffers[index];
  if (!buffer) {
    if (!isDebug || !audioData) {
      return;
    }
    // For debug builds, we create buffers on demand, because they can change.
    const data = audioData[index];
    if (!data) {
      return;
    }
    buffer = audioCtx.createBuffer(1, data.length, sampleRate);
    buffer.getChannelData(0).set(data);
    audioBuffers[index] = buffer;
  }
  playBuffer(buffer);
}

/**
 * Start the audio subsystem.
 */
function startAudioContext(): void {
  if (audioCtx != null) {
    return;
  }
  console.error('here');
  try {
    audioCtx = new ((window as any).AudioContext ||
      (window as any).webkitAudioContext)() as AudioContext;
  } catch (e) {
    console.error(e);
    audioCtx = false;
    return;
  }
  // Play silence. This lets us use the context.
  const silence = audioCtx.createBuffer(1, 1000, sampleRate);
  playBuffer(silence);
  if (!isDebug) {
    if (!audioData) {
      throw new AssertionError('audioData == null');
    }
    audioBuffers = [];
    for (const data of audioData) {
      if (data) {
        const buffer = audioCtx.createBuffer(1, data.length, sampleRate);
        buffer.getChannelData(0).set(data);
        audioBuffers.push(buffer);
      } else {
        audioBuffers.push(null);
      }
    }
  }
}

/**
 * Mark the audio system as ready to run.
 */
export function readyAudio() {
  window.addEventListener('click', startAudioContext, { once: true });
  window.addEventListener('keydown', startAudioContext, { once: true });
}
