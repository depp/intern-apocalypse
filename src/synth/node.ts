/**
 * Audio programming language intermediate representation.
 */

import { CodeEmitter, Opcode } from './opcode';
import * as opcode from './opcode';
import { SourceSpan } from '../lib/sourcepos';
import { AssertionError } from '../debug/debug';
import { dataMax } from '../lib/data.encode';

/** Kinds of nodes. */
export enum Kind {
  Value,
  Variable,
}

/** An operator describes a type of node, such as "sawtooth" or "multiply". */
export interface Operator {
  /** Name of this operator, usually equal to an opcode name. */
  name: string;
  /** Number of compile-time constant parameters the operator accepts. */
  paramCount: number;
  /** Number of inputs. */
  inputCount(params: number[]): number;
  /** Number of outputs. */
  outpuoutputCounts(params: number[]): number;
  /** Write an operation to a code stream. */
  emit(ctx: CodeEmitter, params: number[]): void;
}

/** A node in the processing graph that produces a value directly. */
export interface ValueNode extends SourceSpan {
  kind: Kind.Value;
  operator: Operator;
  params: number[];
  inputs: Node[];
}

/** A node in the processing graph that reuses a previously defined value. */
export interface VariableNode extends SourceSpan {
  kind: Kind.Variable;
  name: string;
}

/** A node in the processing graph. */
export type Node = ValueNode | VariableNode;

/** A complete audio program. */
export interface Program {
  parameterCount: number;
  variables: Map<string, Node>;
  result: Node;
}

/** Emit the code to evaluate a processing graph. */
export function emitCode(program: Program): Uint8Array {
  const { variables, result } = program;

  // Compile information about all variables.
  interface VariableInfo {
    useCount: number;
    value: ValueNode;
    slot: number | null;
    defined: boolean;
  }
  const variableInfo = new Map<string, VariableInfo>();
  function scanNode(node: Node) {
    switch (node.kind) {
      case Kind.Value:
        for (const input of node.inputs) {
          scanNode(input);
        }
        break;
      case Kind.Variable:
        const { name } = node;
        const info = variableInfo.get(name);
        if (info == null) {
          let definition = variables.get(name);
          if (definition == null) {
            throw new AssertionError(
              `reference to undefined variable ${JSON.stringify(name)}`,
            );
          }
          while (definition.kind == Kind.Variable) {
            const { name } = definition;
            definition = variables.get(name);
            if (definition == null) {
              throw new AssertionError(
                `reference to undefined variable ${JSON.stringify(name)}`,
              );
            }
          }
          const numOutputs = getOutputCount(definition);
          if (numOutputs != 1) {
            throw new AssertionError('variable is not single valued', {
              numOutputs,
            });
          }
          variableInfo.set(name, {
            useCount: 1,
            value: definition,
            slot: null,
            defined: false,
          });
          scanNode(definition);
        } else {
          info.useCount++;
        }
        break;
      default:
        const dummy: never = node;
        throw new AssertionError('unknown node kind');
    }
  }
  scanNode(result);

  // Emit the code.
  const ctx = new CodeEmitter();
  function emitNode(node: Node): void {
    switch (node.kind) {
      case Kind.Value:
        for (const input of node.inputs) {
          emitNode(input);
        }
        node.operator.emit(ctx, node.params);
        break;
      case Kind.Variable:
        const { name } = node;
        const info = variableInfo.get(name);
        if (info == null) {
          throw new AssertionError(
            `reference to undefined variable ${JSON.stringify(name)}`,
          );
        }
        if (!info.defined) {
          throw new AssertionError(
            `reference to variable ${JSON.stringify(name)} ` +
              'is before its definition',
          );
        }
        if (info.slot != null) {
          info.useCount--;
          let op: Opcode<1>;
          if (info.useCount > 0) {
            op = opcode.derefCopy;
          } else {
            op = opcode.deref;
          }
          ctx.emit(op, info.slot);
        } else {
          emitNode(info.value);
        }
        break;
      default:
        const dummy: never = node;
        throw new AssertionError('unknown node kind');
    }
  }
  let slot = program.parameterCount;
  for (const info of variableInfo.values()) {
    const { value } = info;
    let doInline =
      // Parameter references are always inlined.
      value.operator == parameter ||
      // Variables used only once are inlined.
      info.useCount <= 1;
    if (!doInline) {
      emitNode(info.value);
      info.slot = slot++;
    }
    info.defined = true;
  }
  emitNode(program.result);
  return ctx.getCode();
}

/** Get the list out outputs for a node. */
function getOutputCount(node: Node): number {
  switch (node.kind) {
    case Kind.Value:
      return node.operator.outpuoutputCounts(node.params);
    case Kind.Variable:
      return 1;
    default:
      const dummy: never = node;
      throw new AssertionError('unknown node kind');
  }
}

/** Format an operator name and parameters for debugging. */
function opName(operator: Operator, params: number[]): string {
  let out = operator.name;
  if (params.length) {
    out += '(';
    out += params[0];
    for (let i = 1; i < params.length; i++) {
      out += ', ';
      out += params[i];
    }
    out += ')';
  }
  return out;
}

/** Create a processing node. */
export function createNode(
  expr: SourceSpan,
  operator: Operator,
  params: number[],
  inputs: Node[],
): ValueNode {
  if (params.length != operator.paramCount) {
    throw new Error(
      `operator ${operator.name} ` +
        `was given ${params.length} parameters, ` +
        `but requires ${operator.paramCount} parameters`,
    );
  }
  for (const param of params) {
    if ((param | 0) != param) {
      throw new AssertionError(`non-integer data`, { param });
    }
    if (param < 0 || dataMax < param) {
      throw new AssertionError(`parameter out of range`, { param });
    }
  }
  let inputCount = 0;
  for (const input of inputs) {
    inputCount += getOutputCount(input);
  }
  const indecls = operator.inputCount(params);
  let match: boolean;
  if (inputCount != indecls) {
    throw new Error(
      `operator ${opName(operator, params)} ` +
        `was given ${inputCount} inputs, ` +
        `but requires ${indecls}`,
    );
  }
  return {
    sourceStart: expr.sourceStart,
    sourceEnd: expr.sourceEnd,
    kind: Kind.Value,
    operator,
    params,
    inputs,
  };
}

/** Create a reference to a variable. */
export function createVariableRef(
  expr: SourceSpan,
  name: string,
): VariableNode {
  return {
    sourceStart: expr.sourceStart,
    sourceEnd: expr.sourceEnd,
    kind: Kind.Variable,
    name,
  };
}

function opSimple(
  op: Opcode<number>,
  inputs: number,
  outputs: number,
): Operator {
  const signature = { inputs, outputs };
  return {
    name: op.name,
    paramCount: op.paramCount,
    inputCount() {
      return inputs;
    },
    outpuoutputCounts() {
      return outputs;
    },
    emit(ctx, params) {
      ctx.emit(op, ...params);
    },
  };
}

// =============================================================================
// Operator definitions
// =============================================================================

// Oscillators and generators
export const oscillator = opSimple(opcode.oscillator, 1, 1);
export const sawtooth = opSimple(opcode.sawtooth, 1, 1);
export const sine = opSimple(opcode.sine, 1, 1);
export const noise = opSimple(opcode.noise, 0, 1);

// Filters
export const highPass = opSimple(opcode.highPass, 1, 1);
export const stateVariableFilter = opSimple(opcode.stateVariableFilter, 2, 1);

// Distortion
export const saturate = opSimple(opcode.saturate, 1, 1);
export const rectify = opSimple(opcode.rectify, 1, 1);

// Envelopes
export const env_start = opSimple(opcode.env_start, 0, 0);
export const env_end = opSimple(opcode.env_end, 0, 1);
export const env_set = opSimple(opcode.env_set, 0, 0);
export const env_lin = opSimple(opcode.env_lin, 0, 0);
export const env_exp = opSimple(opcode.env_exp, 0, 0);
export const env_delay = opSimple(opcode.env_delay, 0, 0);
export const env_gate = opSimple(opcode.env_gate, 0, 0);

// Utilities
export const multiply = opSimple(opcode.multiply, 2, 1);
export const constant = opSimple(opcode.constant, 0, 1);
export const frequency = opSimple(opcode.frequency, 1, 1);
export const mix = opSimple(opcode.mix, 2, 1);
export const zero = opSimple(opcode.zero, 0, 1);
export const scaleInt = opSimple(opcode.scaleInt, 1, 1);

// Parameter references
export const parameter = opSimple(opcode.derefCopy, 0, 1);
export const note = opSimple(opcode.note, 0, 1);
