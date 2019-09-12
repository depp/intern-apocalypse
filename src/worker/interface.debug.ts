/**
 * Debug web worker interface.
 */

/** The contents of an audio program. */
export interface AudioProgramMessage {
  kind: 'sound-program' | 'music-program';
  index: number;
  data: Uint8Array | null;
}

/** A request to render music data. */
export interface RenderMusicMessage {
  kind: 'render-music';
  index: number;
}

/** A single message to the worker. */
export type WorkerRequest = AudioProgramMessage | RenderMusicMessage;

/** The result of evaluating audio data. */
export interface AudioResultMessage {
  kind: 'sound-result' | 'music-result';
  index: number;
  data: Float32Array | null;
}

/** A response from the worker. */
export type WorkerResponse = AudioResultMessage;
