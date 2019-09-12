/**
 * Game audio subsystem.
 */

import { sampleRate } from '../lib/audio';
import { AssertionError, isDebug, isCompetition } from '../debug/debug';
import { soundOffset } from '../lib/loader';
import { Sounds, MusicTracks } from './sounds';
import { bundledData } from '../lib/global';
import { decode } from '../lib/data.encode';

let audioCtx: AudioContext | undefined | false;

/** The sound effect data. */
let sounds: (Float32Array | null)[] = [];
/** Rendered sound effects. */
const soundBuffers: (AudioBuffer | null)[] = [];

/** The music track data. */
let music: (Float32Array | null)[] = [];
/** Rendered music tracks. */
const musicBuffers: (AudioBuffer | null)[] = [];

/** Set the sound data. */
export function setSound(index: number, buffer: Float32Array | null): void {
  sounds[index] = buffer;
  if (isDebug) {
    soundBuffers[index] = null;
  }
}

/** Set the sound data. */
export function setMusic(index: number, buffer: Float32Array | null): void {
  music[index] = buffer;
  if (isDebug) {
    musicBuffers[index] = null;
  }
}

/** Get the buffer containing the given sound. */
function getBuffer(
  assetData: (Float32Array | null)[],
  assetBuffer: (AudioBuffer | null)[],
  index: number,
): AudioBuffer | null {
  if (!audioCtx) {
    throw new AssertionError('audioCtx == null');
  }
  let buffer = assetBuffer[index];
  if (!buffer) {
    const data = assetData[index];
    if (!data) {
      return null;
    }
    buffer = audioCtx.createBuffer(1, data.length, sampleRate);
    buffer.getChannelData(0).set(data);
    assetBuffer[index] = buffer;
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
export function playSound(index: Sounds): void {
  if (!audioCtx) {
    return;
  }
  const buffer = getBuffer(sounds, soundBuffers, index);
  if (!buffer) {
    return;
  }
  playBuffer(buffer);
}

/** Play the music track with the given index. */
export function playMusic(index: MusicTracks): void {
  if (!audioCtx) {
    return;
  }
  const buffer = getBuffer(music, musicBuffers, index);
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
