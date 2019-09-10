/**
 * Audio synthesizer execution engine.
 */

import { AssertionError } from '../debug/debug';
import {
  decodeLinear,
  decodeExponential,
  decodeNote,
  decodeFrequency,
} from './data';
import { Random } from '../lib/random';

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

/** Random number generator for audio. */
let random = new Random(9);

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

/** Return the buffer on the top of the stack, but do not pop it. */
function topBuffer(): Float32Array {
  const result = stack[stack.length - 1];
  if (!(result instanceof Float32Array)) {
    throw new AssertionError('type error');
  }
  return result;
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
  // ===========================================================================
  // Numeric values
  // ===========================================================================

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

  // ===========================================================================
  // Oscillators and generators
  // ===========================================================================

  /** Generate oscillator phase from pitch. */
  function oscillator(): void {
    const out = topBuffer();
    let phase = 0;
    for (let i = 0; i < bufferSize; i++) {
      out[i] = phase = (phase + (1 / sampleRate) * out[i]) % 1;
    }
  },

  /** Generate sawtooth waveform from phase. */
  function sawtooth(): void {
    const out = topBuffer();
    for (let i = 0; i < bufferSize; i++) {
      let x = out[i] % 1;
      if (x < 0) {
        x += 1;
      }
      out[i] = x * 2 - 1;
    }
  },

  function sine(): void {
    const out = topBuffer();
    for (let i = 0; i < bufferSize; i++) {
      out[i] = Math.sin(2 * Math.PI * out[i]);
    }
  },

  /** Create a buffer filled with noise. */
  function noise(): void {
    const out = pushBuffer();
    for (let i = 0; i < bufferSize; i++) {
      out[i] = random.range(-1, 1);
    }
  },

  // ===========================================================================
  // Filters
  // ===========================================================================

  /** Simple constant two-pole high-pass filter with fixed Q. */
  function highPass(): void {
    const out = topBuffer();
    let a = 0;
    let b = 0;
    // We calculate the coefficient in the compiler.
    const f = decodeFrequency(readParam()) / sampleRate;
    for (let i = 0; i < bufferSize; i++) {
      b += f * a;
      a += f * (out[i] -= b + 1.4 * a);
    }
  },

  /** Apply a state-variable filter filter. */
  function stateVariableFilter(): void {
    const [input, frequency] = getArgs(2);
    let a = 0;
    let b = 0;
    let c;
    const mode = readParam();
    const invq = decodeExponential(readParam());
    if (
      !(input instanceof Float32Array) ||
      !(frequency instanceof Float32Array)
    ) {
      throw new AssertionError('type error');
    }
    const lp = new Float32Array(bufferSize);
    const hp = new Float32Array(bufferSize);
    const bp = new Float32Array(bufferSize);
    for (let i = 0; i < bufferSize; i++) {
      // We oversample the filter, running it twice with a corner frequency
      // scaled by 1/2. Without oversampling, the filter stops working well at
      // high frequencies.
      let f = Math.sin(
        ((2 * Math.PI) / sampleRate) * Math.min(frequency[i] / 2, 2e4),
      );
      b += f * a;
      c = input[i] - b - invq * a;
      a += f * c;
      lp[i] = b += f * a;
      hp[i] = c = input[i] - b - invq * a;
      bp[i] = a += f * c;
    }
    stack.push([lp, hp, bp][mode]);
  },

  // ===========================================================================
  // Distortion
  // ===========================================================================

  /** Apply saturation distortion to a buffer. */
  function saturate(): void {
    const out = topBuffer();
    for (let i = 0; i < bufferSize; i++) {
      out[i] = Math.tanh(out[i]);
    }
  },

  /** Replace negative values with zero. */
  function rectify(): void {
    const out = topBuffer();
    for (let i = 0; i < bufferSize; i++) {
      out[i] = Math.max(out[i], 0);
    }
  },

  // ===========================================================================
  // Envelopes
  // ===========================================================================

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

  // ===========================================================================
  // Utilities
  // ===========================================================================

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
    const out = topBuffer();
    for (let i = 0; i < bufferSize; i++) {
      out[i] = 630 * 32 ** out[i];
    }
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

  // =============================================================================
  // Variables
  // =============================================================================

  /** Dereference a variable, indexed from the bottom of the stack. */
  function deref(): void {
    const index = readParam();
    if (index >= stack.length) {
      throw new AssertionError('invalid variable ref');
    }
    stack.push(stack[index]);
  },

  /** Copy a buffer, indexed from the bottom of the stack, copying it. */
  function derefCopy(): void {
    const index = readParam();
    if (index >= stack.length) {
      throw new AssertionError('invalid variable ref');
    }
    const value = stack[index];
    if (!(value instanceof Float32Array)) {
      throw new AssertionError('type error');
    }
    stack.push(new Float32Array(value));
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
  const result = stack.pop();
  if (!(result instanceof Float32Array)) {
    throw new AssertionError('type error');
  }
  return result;
}
