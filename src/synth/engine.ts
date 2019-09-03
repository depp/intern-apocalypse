/**
 * Audio synthesizer execution engine.
 */

import { AssertionError } from '../debug';
import {
  decodeLinear,
  decodeExponential,
  decodeNote,
  decodeFrequency,
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

let envValue!: number;
let envPos!: number;
let envBuf: Float32Array | undefined;

function envWrite(pos: number, value: number): void {
  if (envBuf == null) {
    throw new AssertionError('null envBuf');
  }
  pos = pos | 0;
  const targetPos = Math.min(bufferSize, pos);
  if (pos > envPos) {
    const delta = (value - envValue) / (pos - envPos);
    while (envPos < targetPos) {
      envBuf[envPos++] = envValue += delta;
    }
  }
  envValue = value;
  envPos = targetPos;
}

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

  /** Numeric literal, general frequency encoding. */
  function num_freq(): void {
    stack.push(decodeFrequency(readParam()));
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

  function sine(): void {
    const [out] = getArgs(1);
    if (!(out instanceof Float32Array)) {
      throw new AssertionError('type error');
    }
    for (let i = 0; i < bufferSize; i++) {
      out[i] = Math.sin(2 * Math.PI * out[i]);
    }
    stack.push(out);
  },

  /** Apply a two-pole low pass filter. */
  function lowPass2(): void {
    const [out, frequency] = getArgs(2);
    let a = 0;
    let b = 0;
    const invq = decodeExponential(readParam());
    if (
      !(out instanceof Float32Array) ||
      !(frequency instanceof Float32Array)
    ) {
      throw new AssertionError('type error');
    }
    for (let i = 0; i < bufferSize; i++) {
      // We oversample the filter, running it twice with a corner frequency
      // scaled by 1/2. Without oversampling, the filter stops working well at
      // high frequencies.
      let f = Math.sin(
        ((2 * Math.PI) / sampleRate) * Math.min(frequency[i] / 2, 2e4),
      );
      b += f * a;
      a += f * (out[i] - b - invq * a);
      b += f * a;
      a += f * (out[i] - b - invq * a);
      out[i] = b;
    }
    stack.push(out);
  },

  /** Apply saturation distortion to a buffer. */
  function saturate(): void {
    const top = stack[stack.length - 1];
    if (!(top instanceof Float32Array)) {
      throw new AssertionError('type error');
    }
    for (let i = 0; i < bufferSize; i++) {
      top[i] = Math.tanh(top[i]);
    }
  },

  /** Start a new envelope. */
  function env_start(): void {
    envValue = 0;
    envPos = 0;
    envBuf = new Float32Array(bufferSize);
  },

  /** Finish an envelope, push it on the stack. */
  function env_end(): void {
    envWrite(bufferSize, envValue);
    stack.push(envBuf!);
  },

  /** Envelope: set value. */
  function env_set(): void {
    envValue = decodeLinear(readParam());
  },

  /** Envelope: linear segment. */
  function env_lin(): void {
    envWrite(
      envPos + decodeExponential(readParam()) * sampleRate,
      decodeLinear(readParam()),
    );
  },

  /** Envelope: hold value. */
  function env_delay(): void {
    envWrite(envPos + decodeExponential(readParam()) * sampleRate, envValue);
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

  /** Convert envelope to frequency data. */
  function frequency(): void {
    const [out] = getArgs(1);
    if (!(out instanceof Float32Array)) {
      throw new AssertionError('type error');
    }
    for (let i = 0; i < bufferSize; i++) {
      out[i] = 630 * 32 ** out[i];
    }
    stack.push(out);
  },

  /** Multiply a buffer by a scalar, adding the result to a second buffer. */
  function mix(): void {
    const [out, input] = getArgs(2);
    const p = readParam();
    const level = decodeExponential(p);
    if (!(out instanceof Float32Array) || !(input instanceof Float32Array)) {
      throw new AssertionError('type error');
    }
    for (let i = 0; i < bufferSize; i++) {
      out[i] += level * input[i];
    }
    stack.push(out);
  },

  /** Push a buffer filled with zeroes. */
  function zero(): void {
    pushBuffer();
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
