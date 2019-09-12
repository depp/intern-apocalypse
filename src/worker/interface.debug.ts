/**
 * Debug web worker interface.
 */

/** The contents of an audio program. */
export interface AudioProgramMessage {
  kind: 'audio-program';
  index: number;
  data: Uint8Array | null;
}

/** Set the current music track. */
export interface RenderMusicMessage {
  kind: 'set-music';
  index: number;
}

/** A single message to the worker. */
export type WorkerRequest = AudioProgramMessage | RenderMusicMessage;

/** The result of evaluating audio data. */
export interface AudioResultMessage {
  kind: 'audio-result';
  index: number;
  data: Float32Array | null;
  /* If music - track length, in seconds, not counting audio tail. */
  length: number;
}

/** A response from the worker. */
export type WorkerResponse = AudioResultMessage;
