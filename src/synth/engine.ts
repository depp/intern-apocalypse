/**
 * Audio synthesizer execution engine.
 */

import { AssertionError } from '../debug';
import {
  decodeLinear,
  decodeExponential,
  decodeNote,
  decodeTime,
} from './data';

// =============================================================================
// Definitions and auxiliary pure functions
// =============================================================================

/** Sample rate, in Hz, for the audio system. */
export const sampleRate = 48000;

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
  /** Numeric literal, linear encoding. */
  function num_lin(): void {
    stack.push(decodeLinear(readParam()));
  },

  /** Numeric literal, exponential encoding. */
  function num_expo(): void {
    stack.push(decodeExponential(readParam()));
  },

  /** Numeric literal, musical note frequency encoding. */
  function num_note(): void {
    stack.push(decodeNote(readParam()));
  },

  /** Numeric literal, duration encoding. */
  function num_time(): void {
    stack.push(decodeTime(readParam()));
  },

  /** Generate oscillator phase from pitch. */
  function oscillator(): void {
    const pitch = popBuffer();
    const out = pushBuffer();
    let phase = 0;
    for (let i = 0; i < bufferSize; i++) {
      out[i] = phase = (phase + (1 / sampleRate) * pitch[i]) % 1;
    }
  },

  /** Generate sawtooth waveform from phase. */
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

  /** Apply a two-pole low pass filter. Only works up to about 8 kHz. */
  function lowPass2(): void {
    const frequency = popBuffer();
    const input = popBuffer();
    const out = pushBuffer();
    let a = 0;
    let b = 0;
    let q = 0.2; // Actually 1 / q.
    for (let i = 0; i < bufferSize; i++) {
      let f = ((2 * Math.PI) / sampleRate) * frequency[i];
      out[i] = b += f * a;
      a += f * (input[i] - b - q * a);
    }
  },

  /** Create an envelope. */
  function envelope(): void {
    const size = readParam();
    const inputs = Array(size * 2 + 1)
      .fill(0)
      .map(popNumber);
    const out = pushBuffer();
    inputs.reverse();
    let value = inputs[0];
    let pos = 0;
    for (let i = 0; i < size; i++) {
      const time = (sampleRate * inputs[i * 2 + 1]) | 0;
      const target = inputs[i * 2 + 2];
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

  /** Multiply two buffers. */
  function multiply(): void {
    const in1 = popBuffer();
    const in2 = popBuffer();
    const out = pushBuffer();
    for (let i = 0; i < bufferSize; i++) {
      out[i] = in1[i] * in2[i];
    }
  },

  /** Create a constant envelope from a value. */
  function constant(): void {
    const value = popNumber();
    pushBuffer().fill(value);
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
