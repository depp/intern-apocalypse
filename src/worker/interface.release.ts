/** Background worker request - list of sound and music program data. */
export type WorkerRequest = Uint8Array[][];
/** Background worker response - list of sound and music audio data. */
export type WorkerResponse = (Float32Array | null)[][];
