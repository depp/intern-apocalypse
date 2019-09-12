/**
 * Audio synthesizer execution engine.
 */

import { AssertionError, isDebug, isCompetition } from '../debug/debug';
import {
  decodeLinear,
  decodeExponential,
  decodeNote,
  decodeFrequency,
} from './data';
import { Random } from '../lib/random';
import { sampleRate } from '../lib/audio';

// =============================================================================
// Definitions and auxiliary pure functions
// =============================================================================

/**
 * Get a list of audio opcodes (debug only).
 */
export function runProgram(): string[];
/**
 * Execute an audio program.
 * @param code The compiled program to run.
 * @param noteValue The note value.
 * @param gateTime The gate duration, in seconds.
 */
export function runProgram(
  code: Uint8Array,
  noteValue?: number,
  gateTime?: number,
): Float32Array;
export function runProgram(
  code?: Uint8Array,
  noteValue: number = 48,
  gateTime: number = 0,
): Float32Array | string[] {
  // ===========================================================================
  // Execution state
  // ===========================================================================

  /** The number of samples in each buffer. */
  const bufferSize =
    !isDebug || code
      ? ((gateTime + decodeExponential(code![0])) * sampleRate) | 0
      : 0;

  /** Create a new buffer. */
  function newBuffer(): Float32Array {
    return new Float32Array(bufferSize);
  }

  /** Random number generator for audio. */
  let random = new Random(9);

  /** Current position in the instruction array. */
  let instructionPos = 1;

  /** Read an operator parameter from the instruction stream. */
  function readParam(): number {
    if (!code || code.length <= instructionPos) {
      throw new AssertionError('missing instruction parameters');
    }
    return code[instructionPos++];
  }

  // ===========================================================================
  // Envelope generator state
  // ===========================================================================

  /** Envelope buffer, if we are creating an envelope. */
  let envBuf: Float32Array | undefined | null;
  /** Position in envelope buffer. */
  let envPos: number | undefined;

  // ===========================================================================
  // Filter definition
  // ===========================================================================

  const enum FilterMode {
    LowPass,
    HighPass,
    BandPass,
  }

  /** Apply a state-variable filter. */
  function filter(
    data: Float32Array,
    frequency: Float32Array,
    mode: FilterMode,
    invq: number,
  ): Float32Array {
    for (let i = 0; i <= mode; i += 3) {
      let a = 0;
      let b = 0;
      let c;
      const bufs = [newBuffer(), newBuffer(), newBuffer()];
      const [lp, hp, bp] = bufs;
      for (let i = 0; i < bufferSize; i++) {
        // We oversample the filter, running it twice with a corner frequency
        // scaled by 1/2. Without oversampling, the filter stops working well at
        // high frequencies.
        let f = Math.sin(
          ((2 * Math.PI) / sampleRate) * Math.min(frequency[i] / 2, 2e4),
        );
        b += f * a;
        c = data[i] - b - invq * a;
        a += f * c;
        lp[i] = b += f * a;
        hp[i] = c = data[i] - b - invq * a;
        bp[i] = a += f * c;
      }
      data = bufs[mode % 3];
    }
    return data;
  }

  // ===========================================================================
  // Operator definitions
  // ===========================================================================

  const stack: Float32Array[] = [];

  const operators: ((...args: Float32Array[]) => Float32Array | void)[] = [
    // =========================================================================
    // Oscillators and generators
    // =========================================================================

    /** Generate oscillator phase from pitch. */
    function oscillator(buf): Float32Array {
      let phase = 0;
      return buf.map(x => (phase = (phase + (1 / sampleRate) * x) % 1));
    },

    /** Generate sawtooth waveform from phase. */
    function sawtooth(buf): Float32Array {
      return buf.map(x => 2 * ((x %= 1) < 0 ? x + 1 : x) - 1);
    },

    /** Generate sine waveform from phase. */
    function sine(buf): Float32Array {
      return buf.map(x => Math.sin(2 * Math.PI * x));
    },

    /** Create a buffer filled with noise. */
    function noise(): Float32Array {
      return newBuffer().map(x => random.range(-1, 1));
    },

    // =========================================================================
    // Filters
    // =========================================================================

    /** Simple constant two-pole high-pass filter with fixed Q. */
    function highPass(buf): Float32Array {
      return filter(
        buf,
        new Float32Array(bufferSize).fill(decodeFrequency(readParam())),
        FilterMode.HighPass,
        1.4,
      );
    },

    /** Apply a state-variable filter. */
    function stateVariableFilter(buf, frequency): Float32Array {
      return filter(
        buf,
        frequency,
        readParam(),
        decodeExponential(readParam()),
      );
    },

    // =========================================================================
    // Distortion
    // =========================================================================

    /** Apply saturation distortion to a buffer. */
    function saturate(buf): Float32Array {
      return buf.map(Math.tanh);
    },

    /** Replace negative values with zero. */
    function rectify(buf): Float32Array {
      return buf.map(x => (x > 0 ? x : 0));
    },

    // =========================================================================
    // Envelopes
    // =========================================================================

    /** Start a new envelope. */
    function env_start(): void {
      if (envBuf) {
        throw new AssertionError('non-null env');
      }
      envBuf = newBuffer();
      envPos = 0;
    },

    /** Finish an envelope, push it on the stack. */
    function env_end(): Float32Array {
      if (!envBuf) {
        throw new AssertionError('null env');
      }
      if (isCompetition) {
        return envBuf;
      }
      const value = envBuf;
      envBuf = null;
      return value;
    },

    /** Envelope: set value. */
    function env_set(): void {
      if (!envBuf || envPos == null) {
        throw new AssertionError('null env');
      }
      envBuf.fill(decodeLinear(readParam()), envPos);
    },

    /** Envelope: linear segment. */
    function env_lin(): void {
      if (!envBuf || envPos == null) {
        throw new AssertionError('null env');
      }
      const deltaTime = (decodeExponential(readParam()) * sampleRate) | 0;
      const endValue = decodeLinear(readParam());
      let value = envBuf[envPos];
      const endPos = envPos + deltaTime;
      const delta = (endValue - value) / deltaTime;
      for (; envPos < endPos; envPos++) {
        envBuf[envPos] = value += delta;
      }
      envBuf.fill(endValue, endPos);
    },

    /** Envelope: exponential segment. */
    function env_exp(): void {
      if (!envBuf || envPos == null) {
        throw new AssertionError('null env');
      }
      const coefficient = 1 / (decodeExponential(readParam()) * sampleRate);
      const startPos = envPos;
      const base = decodeLinear(readParam());
      const delta = envBuf[envPos] - base;
      for (let i = envPos; i < bufferSize; i++) {
        envBuf[i] = base + delta * Math.exp((startPos - i) * coefficient);
      }
      while (envPos < bufferSize && Math.abs(envBuf[envPos] - base) > 0.05) {
        envPos++;
      }
    },

    /** Envelope: hold value. */
    function env_delay(): void {
      if (!envBuf || envPos == null) {
        throw new AssertionError('null env');
      }
      envPos += (decodeExponential(readParam()) * sampleRate) | 0;
    },

    /** Envelope: hold value until gate. */
    function env_gate(): void {
      envPos = (gateTime * sampleRate) | 0;
    },

    // =========================================================================
    // Utilities
    // =========================================================================

    /** Multiply two buffers. */
    function multiply(buf1, buf2): Float32Array {
      return buf1.map((x, i) => x * buf2[i]);
    },

    /** Create a constant frequency envelope from a value. */
    function constant(): Float32Array {
      return newBuffer().fill(decodeFrequency(readParam()));
    },

    /** Convert envelope to frequency data. */
    function frequency(buf): Float32Array {
      return buf.map(x => 630 * 32 ** x);
    },

    /** Multiply a buffer by a scalar, adding the result to a second buffer. */
    function mix(buf1, buf2): Float32Array {
      const level = decodeExponential(readParam());
      return buf1.map((x, i) => x + level * buf2[i]);
    },

    /** Push a buffer filled with zeroes. */
    function zero(): Float32Array {
      return newBuffer();
    },

    /** Scale a buffer by an integer. */
    function scaleInt(buf): Float32Array {
      const scale = readParam();
      return buf.map(x => x * scale);
    },

    // =========================================================================
    // Variables
    // =========================================================================

    /** Dereference a variable, indexed from the bottom of the stack. */
    function deref(): Float32Array {
      const index = readParam();
      if (index >= stack.length) {
        throw new AssertionError('invalid variable ref');
      }
      return stack[index];
    },

    /** Copy a buffer, indexed from the bottom of the stack, copying it. */
    function derefCopy(): void {
      const index = readParam();
      if (index >= stack.length) {
        throw new AssertionError('invalid variable ref');
      }
      const value = stack[index];
      stack.push(new Float32Array(value));
    },

    /** Create a buffer containing the musical note, as a frequency. */
    function note(): Float32Array {
      return newBuffer().fill(decodeNote(noteValue + readParam() - 48));
    },
  ];

  // ===========================================================================
  // Execution
  // ===========================================================================

  if (!code) {
    const names: string[] = [];
    for (const operator of operators) {
      names.push(operator.name);
    }
    return names;
  }

  while (instructionPos < code.length) {
    const func = operators[code[instructionPos++]];
    if (func == null) {
      throw new AssertionError('invalid opcode');
    }
    const result = func(...stack.splice(stack.length - func.length));
    if (result) {
      stack.push(result);
    }
  }
  const result = stack.pop();
  if (!result) {
    throw new AssertionError('type error');
  }
  return result;
}
