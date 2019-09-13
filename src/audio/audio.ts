/**
 * Game audio subsystem.
 */

import { sampleRate } from '../lib/audio';
import { AssertionError, isDebug } from '../debug/debug';
import { Sounds, MusicTracks, firstMusicTrack } from './sounds';
import { canvas } from '../lib/global';

let audioCtx: AudioContext | undefined | false;

/** The audio data. Loaded by setAudioDebug and setAudioRelease. */
let audioData: (Float32Array | null)[] | undefined;
/** The audio buffer objects. */
let audioBuffers: (AudioBuffer | null)[] | undefined;
/** Length of each music track, in seconds, not counting tail. */
let musicLengths: number[] | undefined;

/**
 * Load an audio buffer into the given slot.
 */
export function setAudioDebug(
  index: number,
  data: Float32Array | null,
  length: number,
): void {
  if (!audioData) {
    audioData = [];
  }
  audioData[index] = data;
  if (!audioBuffers) {
    audioBuffers = [];
  }
  audioBuffers[index] = null;
  if (index >= firstMusicTrack) {
    if (!musicLengths) {
      musicLengths = [];
    }
    musicLengths[index - firstMusicTrack] = length;
  }
  if (index == musicTrack) {
    if (musicNode) {
      musicNode.stop();
    }
    startMusic(index);
  }
}

/**
 * Load audio buffers into all slots.
 */
export function setAudioRelease([data, lengths]: [
  (Float32Array | null)[],
  number[],
]): void {
  audioData = data;
  musicLengths = lengths;
}

/** Play a sound with the given buffer. */
function playBuffer(buffer: AudioBuffer): AudioBufferSourceNode {
  if (!audioCtx) {
    throw new AssertionError('audioCtx == null');
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
  return source;
}

/** Play the sound with the given index. */
export function playSound(
  index: Sounds | MusicTracks,
): AudioBufferSourceNode | undefined {
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
  return playBuffer(buffer);
}

let musicTrack: MusicTracks | undefined;
let musicNode: AudioBufferSourceNode | undefined | null;
let loopTimeout: number | undefined;

function loopMusic(): void {
  if (musicTrack == null) {
    throw new AssertionError('musicTrack == null');
  }
  if (!musicNode) {
    throw new AssertionError('!musicNode');
  }
  startMusic(musicTrack);
}

function startMusic(index: MusicTracks): void {
  musicTrack = index;
  musicNode = playSound(index);
  if (!musicNode) {
    return;
  }
  clearTimeout(loopTimeout);
  if (!musicLengths) {
    throw new AssertionError('!musicLengths');
  }
  const length = musicLengths[index - firstMusicTrack];
  loopTimeout = setTimeout(loopMusic, 1000 * length);
}

/** Play a music track, on repeat. */
export function playMusic(index: MusicTracks): void {
  if (musicTrack != index) {
    if (musicNode) {
      musicNode.stop();
      musicNode = null;
    }
    startMusic(index);
  }
}

/**
 * Start the audio subsystem.
 */
function startAudioContext(): void {
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
  const silence = audioCtx.createBuffer(1, 1000, sampleRate);
  playBuffer(silence);
  if (isDebug) {
    audioData = audioData || [];
    audioBuffers = audioBuffers || [];
  } else {
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
