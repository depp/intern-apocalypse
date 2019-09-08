/**
 * Opcode definitions for audio programs.
 */

import { AssertionError } from '../debug/debug';
import { operators } from './engine';

/** Definition of an opcode. */
export interface Opcode<N> {
  readonly name: string;
  readonly value: number;
  readonly paramCount: N;
}

/** Check that a name is a legal operator name. */
function checkName(name: string): void {
  if (name == '') {
    throw new Error('empty operator name');
  }
  if (!name.match(/^[_A-Za-z0-9]+$/)) {
    throw new Error(`invalid operator name ${JSON.stringify(name)}`);
  }
}

/** Map from opcode name to opcodes, only used for defining opcodes. */
const nameToValue: ReadonlyMap<string, number> = (() => {
  const r = new Map<string, number>();
  for (let i = 0; i < operators.length; i++) {
    const name = operators[i].name;
    checkName(name);
    if (r.has(name)) {
      throw new Error(`duplicate operator name ${JSON.stringify(name)}`);
    }
    r.set(name, i);
  }
  return r;
})();

const byName = new Map<string, Opcode<number>>();
const byValue = new Map<number, Opcode<number>>();

function opcode<N extends number>(name: string, paramCount: N): Opcode<N> {
  const value = nameToValue.get(name);
  if (value == null) {
    throw new AssertionError(`no such opcode ${JSON.stringify(name)}`);
  }
  if (byName.has(name)) {
    throw new AssertionError(`opcode ${JSON.stringify(name)} already defined`);
  }
  const opcode: Opcode<N> = { name, value, paramCount };
  byName.set(name, opcode);
  byValue.set(value, opcode);
  return opcode;
}

/**
 * Bytecode emitter.
 */
export class CodeEmitter {
  private readonly code: number[] = [];

  /** Emit an instruction and its operands. */
  emit(opcode: Opcode<0>): void;
  emit(opcode: Opcode<1>, param1: number): void;
  emit(opcode: Opcode<number>, ...params: number[]): void;
  emit(opcode: Opcode<number>, ...params: number[]): void {
    this.code.push(opcode.value);
    for (const param of params) {
      if (param != (param | 0) || param < 0 || 255 < param) {
        throw new AssertionError(
          `code value out of range: ${JSON.stringify(param)}`,
        );
      }
      this.code.push(param);
    }
  }

  /** Get the emitted code. */
  getCode(): Uint8Array {
    return new Uint8Array(this.code);
  }
}

/**
 * Disassemble a program.
 * @param code Compiled program.
 * @returns Dissassembly, with one instruction per line.
 */
export function disassembleProgram(code: Uint8Array): string[] {
  const fields: string[] = [];
  const result: string[] = [];
  let pos = 0;
  while (pos < code.length) {
    const opvalue = code[pos];
    const opcode = byValue.get(opvalue);
    if (opcode == null) {
      throw new Error(`unknown opcode ${opvalue} at position ${pos}`);
    }
    const { name, paramCount } = opcode;
    fields.push(name);
    if (code.length - pos < paramCount + 1) {
      throw new Error('unexpected end of code when parsing opcode');
    }
    for (let i = 0; i < paramCount; i++) {
      fields.push(code[pos + 1 + i].toString());
    }
    result.push(fields.join(' '));
    pos += 1 + paramCount;
    fields.length = 0;
  }
  return result;
}

// =============================================================================
// Opcode definitions
// =============================================================================

// Those correspond directly to functions in synth.ts.

// Data encodings.
export const num_lin = opcode('num_lin', 1);
export const num_expo = opcode('num_expo', 1);
export const num_note = opcode('num_note', 1);
export const num_freq = opcode('num_freq', 1);

// Simple operators.
export const oscillator = opcode('oscillator', 0);
export const sawtooth = opcode('sawtooth', 0);
export const sine = opcode('sine', 0);
export const noise = opcode('noise', 0);
export const lowPass2 = opcode('lowPass2', 1);
export const multiply = opcode('multiply', 0);
export const constant = opcode('constant', 0);
export const frequency = opcode('frequency', 0);
export const saturate = opcode('saturate', 0);
export const rectify = opcode('rectify', 0);
export const mix = opcode('mix', 1);
export const zero = opcode('zero', 0);

// Envelopes.
export const env_start = opcode('env_start', 0);
export const env_end = opcode('env_end', 0);
export const env_set = opcode('env_set', 1);
export const env_lin = opcode('env_lin', 2);
export const env_delay = opcode('env_delay', 1);

// Check that all opcodes have definitions.
for (const name of nameToValue.keys()) {
  if (!byName.has(name)) {
    throw new Error(`opcode ${JSON.stringify(name)} not defined`);
  }
}
