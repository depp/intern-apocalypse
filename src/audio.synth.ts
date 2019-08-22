/**
 * Audio synthesizer core funcitons.
 */

/** Sample rate, in Hz, for the audio system. */
export const sampleRate = 48000;

function oscillator(result: Float32Array, pitch: Float32Array): void {
  let phase = 0;
  for (let i = 0; i < result.length; i++) {
    result[i] = phase = (phase + pitch[i]) % 1;
  }
}

/**
 * Generate test audio.
 */
export function generateAudio(): Float32Array {
  const length = sampleRate;
  const pitch = 440;
  const pitchArray = new Float32Array(length);
  const oscArray = new Float32Array(length);
  pitchArray.fill(pitch / sampleRate);
  oscillator(oscArray, pitchArray);
  return oscArray;
}
