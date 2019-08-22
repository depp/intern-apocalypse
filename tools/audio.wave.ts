/**
 * WAVE file support.
 */
import { Random } from '../src/random';

/** Data to write in a WAVE file. */
export interface WaveData {
  sampleRate: number;
  channelCount: number;
  audio: Int16Array;
}

const random = new Random(123456789);

/** Convert floating-point audio to 16-bit audio. */
export function floatTo16(input: Float32Array): Int16Array {
  // Simple rectangular dither.
  const scale = 0x8000;
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let value = Math.floor(scale * input[i] + random.range()) | 0;
    if (value > 0x7fff) {
      value = 0x7fff;
    } else if (value < -0x8000) {
      value = -0x8000;
    }
    output[i] = value;
  }
  return output;
}

/**
 * Create a WAVE file as a buffer.
 */
export function waveData(options: WaveData): Buffer {
  const { sampleRate, channelCount, audio } = options;
  const sampleSizeBytes = 2;
  const dataLengthBytes = audio.length * sampleSizeBytes;
  const frameSizeBytes = channelCount * sampleSizeBytes;
  const bitsPerByte = 8;
  const out = Buffer.alloc(44 + dataLengthBytes);

  out.write('RIFF', 0, 4);
  out.writeInt32LE(dataLengthBytes + 36, 4);
  out.write('WAVE', 8, 4);

  out.write('fmt ', 12, 4);
  out.writeInt32LE(16, 16);
  out.writeInt16LE(1, 20); // format: 1 = pcm
  out.writeInt16LE(channelCount, 22);
  out.writeInt32LE(sampleRate, 24);
  out.writeInt32LE(sampleRate * frameSizeBytes, 28);
  out.writeInt16LE(frameSizeBytes, 32);
  out.writeInt16LE(sampleSizeBytes * bitsPerByte, 34);

  out.write('data', 36, 4);
  out.writeInt32LE(dataLengthBytes, 40);
  out.set(new Uint8Array(audio.buffer), 44);

  return out;
}
