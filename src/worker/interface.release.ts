/** Background worker request - list of sound and music program data. */
export type WorkerRequest = Uint8Array[];
/**
 * Background worker response - list of sound and music audio data, followed by
 * the length of each music track.
 */
export type WorkerResponse = [(Float32Array | null)[], number[]];
