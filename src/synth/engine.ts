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

/** Get an unused buffer, push it onto the stack, and return it. */
function pushBuffer(): Float32Array {
  const result = new Float32Array(bufferSize);
  stack.push(result);
  return result;
}

/**
 * Read oporator arguments from the top of the stack, popping them.
 */
function getArgs(argCount: number): (Float32Array | number)[] {
  if (stack.length < argCount) {
    throw new AssertionError('stack underflow');
  }
  return stack.splice(stack.length - argCount);
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
    const [out] = getArgs(1);
    let phase = 0;
    if (!(out instanceof Float32Array)) {
      throw new AssertionError('type error');
    }
    for (let i = 0; i < bufferSize; i++) {
      out[i] = phase = (phase + (1 / sampleRate) * out[i]) % 1;
    }
    stack.push(out);
  },

  /** Generate sawtooth waveform from phase. */
  function sawtooth(): void {
    const [out] = getArgs(1);
    if (!(out instanceof Float32Array)) {
      throw new AssertionError('type error');
    }
    for (let i = 0; i < bufferSize; i++) {
      let x = out[i] % 1;
      if (x < 0) {
        x += 1;
      }
      out[i] = x * 2 - 1;
    }
    stack.push(out);
  },

  /** Apply a two-pole low pass filter. Only works up to about 8 kHz. */
  function lowPass2(): void {
    const [out, frequency] = getArgs(2);
    let a = 0;
    let b = 0;
    let q = 0.2; // Actually 1 / q.
    if (
      !(out instanceof Float32Array) ||
      !(frequency instanceof Float32Array)
    ) {
      throw new AssertionError('type error');
    }
    for (let i = 0; i < bufferSize; i++) {
      let f = ((2 * Math.PI) / sampleRate) * frequency[i];
      b += f * a;
      a += f * (out[i] - b - q * a);
      out[i] = b;
    }
    stack.push(out);
  },

  /** Create an envelope. */
  function envelope(): void {
    const size = readParam();
    const inputs = getArgs(size * 2 + 1) as number[];
    if (!inputs.every(x => typeof x == 'number')) {
      throw new AssertionError('type error');
    }
    const out = pushBuffer();
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
    const [out, input] = getArgs(2);
    if (!(out instanceof Float32Array) || !(input instanceof Float32Array)) {
      throw new AssertionError('type error');
    }
    for (let i = 0; i < bufferSize; i++) {
      out[i] *= input[i];
    }
    stack.push(out);
  },

  /** Create a constant envelope from a value. */
  function constant(): void {
    const [value] = getArgs(1);
    if (typeof value != 'number') {
      throw new AssertionError('type error');
    }
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
  if (stack.length != 1) {
    throw new AssertionError('type error');
  }
  const result = stack.pop();
  if (!(result instanceof Float32Array)) {
    throw new AssertionError('type error');
  }
  return result;
}
