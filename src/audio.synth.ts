import { AssertionError } from './debug';

/**
 * Audio synthesizer core funcitons.
 */

// =============================================================================
// Definitions and auxiliary pure functions
// =============================================================================

/** Sample rate, in Hz, for the audio system. */
export const sampleRate = 48000;

/** The note value corresponding to C4. */
export const middleC = 48;

/** Decode a time value from the data stream. */
function decodeTime(x: number): number {
  // This gives us a range of 5ms to 29s, plus 0.
  return x && 0.005 * 1.1 ** x;
}

/** Decode a voltage used as a control signal. */
function decodeVoltage(x: number): number {
  // This gives us a range of -1 to +1, with an extra 1.02.
  return (1 / 45) * (x - 45);
}

/** Decode a musical note value from the data stream. */
function decodeNote(x: number): number {
  return (440 / sampleRate) * 2 ** ((x - (middleC + 9)) / 12);
}

/** Decode a gain value from the data stream. */
function decodeGain(x: number): number {
  return 0.9 ** (91 - x);
}

// =============================================================================
// Execution state
// =============================================================================

/** The number of samples in each buffer. */
let bufferSize = sampleRate * 2;

/** Synthesizer numeric execution stack. */
const stack: (number | Float32Array)[] = [];

/** Pop a number off the stack. */
function popNumber(): number {
  const value = stack.pop();
  if (typeof value != 'number') {
    throw new AssertionError('top of stack is not a number');
  }
  return value;
}

/** Pop a buffer off the stack and return it. */
function popBuffer(): Float32Array {
  const value = stack.pop();
  if (!(value instanceof Float32Array)) {
    throw new AssertionError('top of stack is not a buffer');
  }
  return value;
}

/** Get an unused buffer, push it onto the stack, and return it. */
function pushBuffer(): Float32Array {
  const result = new Float32Array(bufferSize);
  stack.push(result);
  return result;
}

/** Array of instructions being processed. */
let instructions!: Uint8Array;

/** Current position in the instruction array. */
let instructionPos: number;

/** Read an operator parameter from the instruction stream. */
function readParam(): number {
  if (instructions.length <= instructionPos) {
    throw new AssertionError('missing instruction parameters');
  }
  return instructions[instructionPos++];
}

/** Read operator parameters from the instruction stream. */
function readParams(n: number): ArrayLike<number> {
  if (n < 0 || instructions.length - instructionPos < n) {
    throw new AssertionError('missing instruction parameters');
  }
  return instructions.slice(instructionPos, (instructionPos += n));
}

// =============================================================================
// Operator definitions
// =============================================================================

/**
 * Array of main operators.
 */
export const operators: (() => void)[] = [
  /**
   * Numeric literal.
   */
  function number(): void {
    stack.push(readParam());
  },

  /**
   * Generate oscillator phase from pitch.
   */
  function oscillator(): void {
    const pitch = popBuffer();
    const out = pushBuffer();
    let phase = 0;
    for (let i = 0; i < bufferSize; i++) {
      out[i] = phase = (phase + pitch[i]) % 1;
    }
  },

  /**
   * Generate sawtooth waveform from phase.
   */
  function sawtooth(): void {
    const phase = popBuffer();
    const out = pushBuffer();
    for (let i = 0; i < bufferSize; i++) {
      let x = phase[i] % 1;
      if (x < 0) {
        x += 1;
      }
      out[i] = x * 2 - 1;
    }
  },

  /**
   * Apply a two-pole low pass filter. Only works up to about 8 kHz.
   */
  function lowPass2(): void {
    const frequency = popBuffer();
    const input = popBuffer();
    const out = pushBuffer();
    let a = 0;
    let b = 0;
    let q = 0.2; // Actually 1 / q.
    for (let i = 0; i < bufferSize; i++) {
      let f = 2 * Math.PI * frequency[i];
      out[i] = b += f * a;
      a += f * (input[i] - b - q * a);
    }
  },

  /**
   * Create an envelope.
   */
  function envelope(): void {
    const size = readParam();
    const params = Array(size * 2 + 1)
      .fill(0)
      .map(popNumber);
    const out = pushBuffer();
    params.reverse();
    let value = decodeVoltage(params[0]);
    let pos = 0;
    for (let i = 0; i < size; i++) {
      const time = (decodeTime(params[i * 2 + 1]) * sampleRate) | 0;
      const target = decodeVoltage(params[i * 2 + 2]);
      if (time) {
        const delta = (target - value) / time;
        const targetTime = Math.min(pos + time, bufferSize);
        while (pos < targetTime) {
          out[pos++] = value += delta;
        }
      }
      value = target;
    }
    while (pos < bufferSize) {
      out[pos++] = value;
    }
  },

  /**
   * Multiply two buffers.
   */
  function multiply(): void {
    const in1 = popBuffer();
    const in2 = popBuffer();
    const out = pushBuffer();
    for (let i = 0; i < bufferSize; i++) {
      out[i] = in1[i] * in2[i];
    }
  },

  /**
   * Convert a number to a frequency, in cycles per sample.
   */
  function frequency(): void {
    const input = popNumber();
    stack.push(decodeNote(input));
  },

  /**
   * Convert an envelope to gain data.
   */
  function gain(): void {
    const input = popBuffer();
    const out = pushBuffer();
    for (let i = 0; i < bufferSize; i++) {
      out[i] = decodeGain(input[i]);
    }
  },

  /**
   * Create a constant envelope from a value.
   */
  function constant(): void {
    const value = popNumber();
    pushBuffer().fill(value);
  },

  /**
   * Convert a buffer from linear to exponential values.
   */
  function expscale(): void {
    const input = popBuffer();
    const maximum = popNumber();
    const minimum = popNumber();
    const ratio = Math.log(maximum / minimum);
    const out = pushBuffer();
    for (let i = 0; i < bufferSize; i++) {
      out[i] = minimum * Math.exp(ratio * input[i]);
    }
  },
];

// =============================================================================
// Execution
// =============================================================================

/**
 * Execute an audio program.
 * @param code The compiled program to run.
 */
export function runProgram(code: Uint8Array): Float32Array {
  instructions = code;
  instructionPos = 0;
  stack.length = 0;
  while (instructionPos < code.length) {
    const func = operators[code[instructionPos++]];
    if (func == null) {
      throw new AssertionError('invalid opcode');
    }
    func();
  }
  return popBuffer();
}
