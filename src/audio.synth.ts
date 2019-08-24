/**
 * Audio synthesizer core funcitons.
 */

/** Sample rate, in Hz, for the audio system. */
export const sampleRate = 48000;

/**
 * Generate oscillator phase.
 * @param result Array to store output.
 * @param pitch Array containing pitch values, relative to f_s.
 */
function oscillator(result: Float32Array, pitch: Float32Array): void {
  let phase = 0;
  for (let i = 0; i < result.length; i++) {
    result[i] = phase = (phase + pitch[i]) % 1;
  }
}

/**
 * Apply a two-pole low pass filter. Only works up to about 8 kHz.
 * @param out Output audio.
 * @param input Input audio.
 * @param frequency Input frequency.
 */
function twoPoleLowPass(
  out: Float32Array,
  input: Float32Array,
  frequency: Float32Array,
): void {
  let a = 0;
  let b = 0;
  let q = 0.2; // Actually 1 / q.
  for (let i = 0; i < out.length; i++) {
    let f = ((2 * Math.PI) / sampleRate) * frequency[i];
    out[i] = b += f * a;
    a += f * (input[i] - b - q * a);
  }
}

/**
 * Generate envelope data.
 * @param result Array to store output.
 * @param params Envelope time and level parameters: (v0, t1, v1, ...)
 */
function envelope(result: Float32Array, params: number[]): void {
  let value = params[0];
  let pos = 0;
  for (let i = 1; i < params.length; i += 2) {
    const envTime = (params[i] * sampleRate) | 0;
    const envValue = params[i + 1];
    if (envTime > 0) {
      const increment = (envValue - value) / envTime;
      const target = Math.min(pos + envTime, result.length);
      while (pos < target) {
        result[pos++] = value += increment;
      }
    }
    value = envValue;
  }
  while (pos < result.length) {
    result[pos++] = value;
  }
}

/**
 * Multiply two buffers.
 */
function multiply(
  result: Float32Array,
  a: Float32Array,
  b: Float32Array,
): void {
  for (let i = 0; i < result.length; i++) {
    result[i] = a[i] * b[i];
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
  const freqArray = new Float32Array(length);
  const ampArray = new Float32Array(length);
  const outArray = new Float32Array(length);
  pitchArray.fill(pitch / sampleRate);
  oscillator(oscArray, pitchArray);
  envelope(freqArray, [6000, 1, 1000]);
  twoPoleLowPass(outArray, oscArray, freqArray);
  envelope(ampArray, [0, 0.1, 1, 0.9, 0]);
  multiply(outArray, ampArray, outArray);
  return outArray;
}
