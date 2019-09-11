/**
 * Game audio subsystem.
 */

import { runProgram, sampleRate } from '../synth/engine';
import { AssertionError } from '../debug/debug';
import { bundledData } from '../lib/global';
import { soundOffset } from '../lib/loader';
import { decode } from '../lib/data.encode';
import { Sounds, MusicTracks } from './sounds';
import { renderScore } from '../score/score';

let audioCtx: AudioContext | undefined | false;

/** The sound effect file data. */
export let sounds: (Uint8Array | null)[] = [];
/** Rendered sound effects. */
export const soundBuffers: AudioBuffer[] = [];

/** The music track file data. */
export let music: (Uint8Array | null)[] = [];
/** Rendered music tracks. */
export const musicBuffers: AudioBuffer[] = [];

/** Get the buffer containing the given sound. */
function getBuffer(
  assetCode: (Uint8Array | null)[],
  assetBuffer: AudioBuffer[],
  index: number,
  render: (code: Uint8Array) => Float32Array,
): AudioBuffer | null {
  if (!audioCtx) {
    throw new AssertionError('audioCtx == null');
  }
  let buffer = assetBuffer[index];
  if (!buffer) {
    const code = assetCode[index];
    if (!code) {
      return null;
    }
    const audio = render(code);
    buffer = audioCtx.createBuffer(1, audio.length, sampleRate);
    buffer.getChannelData(0).set(audio);
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
  const buffer = getBuffer(sounds, soundBuffers, index, runProgram);
  if (!buffer) {
    return;
  }
  playBuffer(buffer);
}

/** Play the music track with the given index. */
export function playMusic(index: MusicTracks): void {
  debugger;
  if (!audioCtx) {
    return;
  }
  const buffer = getBuffer(music, musicBuffers, index, code =>
    renderScore(code, sounds),
  );
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
  music = bundledData[soundOffset + 1].split(' ').map(decode);
}
