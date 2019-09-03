/**
 * Audio programming language intermediate representation.
 */

import { CodeEmitter, Opcode } from './opcode';
import * as opcode from './opcode';
import { SourceSpan } from '../sourcepos';

/** The type of an input or output to a processing node. */
export enum Type {
  Scalar,
  Buffer,
}

/** An operator describes a type of node, such as "sawtooth" or "multiply". */
export interface Operator {
  /** Name of this operator, usually equal to an opcode name. */
  name: string;
  /** Number of compile-time constant parameters the operator accepts. */
  paramCount: number;
  /** Type signature of inputs. */
  inputs(params: number[]): Type[];
  /** Type signature of outputs. */
  outputs(params: number[]): Type[];
  /** Write an operation to a code stream. */
  emit(ctx: CodeEmitter, params: number[]): void;
}

/** A node in the processing graph. */
export interface Node extends SourceSpan {
  operator: Operator;
  params: number[];
  inputs: Node[];
}

function emitNode(ctx: CodeEmitter, node: Node): void {
  for (const input of node.inputs) {
    emitNode(ctx, input);
  }
  return node.operator.emit(ctx, node.params);
}

/** Emit the code to evaluate a processing graph. */
export function emitCode(node: Node): Uint8Array {
  const ctx = new CodeEmitter();
  emitNode(ctx, node);
  return ctx.getCode();
}

/** Get the list out outputs for a node. */
function getOutputs(node: Node): readonly Type[] {
  return node.operator.outputs(node.params);
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

/** Format a list of types for debugging. */
function typeList(types: Type[]): string {
  let out = '[';
  if (types.length) {
    out += Type[types[0]];
    for (let i = 1; i < types.length; i++) {
      out += ', ';
      out += Type[types[i]];
    }
  }
  out += ']';
  return out;
}

/** Create a processing node. */
export function createNode(
  expr: SourceSpan,
  operator: Operator,
  params: number[],
  inputs: Node[],
): Node {
  if (params.length != operator.paramCount) {
    throw new Error(
      `operator ${operator.name} ` +
        `was given ${params.length} parameters, ` +
        `but requires ${operator.paramCount} parameters`,
    );
  }
  const intypes: Type[] = [];
  for (const input of inputs) {
    intypes.push(...getOutputs(input));
  }
  const indecls = operator.inputs(params);
  let match: boolean;
  if (intypes.length != indecls.length) {
    match = false;
  } else {
    match = true;
    for (let i = 0; i < intypes.length; i++) {
      if (intypes[i] != indecls[i]) {
        match = false;
        break;
      }
    }
  }
  if (!match) {
    throw new Error(
      `operator ${opName(operator, params)} ` +
        `was given inputs ${typeList(intypes)}, ` +
        `but requires ${typeList(intypes)}`,
    );
  }
  return {
    sourceStart: expr.sourceStart,
    sourceEnd: expr.sourceEnd,
    operator,
    params,
    inputs,
  };
}

function opSimple(
  op: Opcode<number>,
  inputs: Type[],
  outputs: Type[],
): Operator {
  const signature = { inputs, outputs };
  return {
    name: op.name,
    paramCount: op.paramCount,
    inputs() {
      return inputs;
    },
    outputs() {
      return outputs;
    },
    emit(ctx, params) {
      ctx.emit(op, ...params);
    },
  };
}

function opConstant(op: Opcode<1>): Operator {
  return opSimple(op, [], [Type.Scalar]);
}

// =============================================================================
// Operator definitions
// =============================================================================

export const num_lin = opConstant(opcode.num_lin);
export const num_expo = opConstant(opcode.num_expo);
export const num_note = opConstant(opcode.num_note);
export const num_freq = opConstant(opcode.num_freq);

export const oscillator = opSimple(
  opcode.oscillator,
  [Type.Buffer],
  [Type.Buffer],
);
export const sawtooth = opSimple(opcode.sawtooth, [Type.Buffer], [Type.Buffer]);
export const sine = opSimple(opcode.sine, [Type.Buffer], [Type.Buffer]);
export const lowPass2 = opSimple(
  opcode.lowPass2,
  [Type.Buffer, Type.Buffer],
  [Type.Buffer],
);
export const multiply = opSimple(
  opcode.multiply,
  [Type.Buffer, Type.Buffer],
  [Type.Buffer],
);
export const constant = opSimple(opcode.constant, [Type.Scalar], [Type.Buffer]);
export const frequency = opSimple(
  opcode.frequency,
  [Type.Buffer],
  [Type.Buffer],
);
export const saturate = opSimple(opcode.saturate, [Type.Buffer], [Type.Buffer]);
export const mix = opSimple(
  opcode.mix,
  [Type.Buffer, Type.Buffer],
  [Type.Buffer],
);
export const zero = opSimple(opcode.zero, [], [Type.Buffer]);

export const env_start = opSimple(opcode.env_start, [], []);
export const env_end = opSimple(opcode.env_end, [], [Type.Buffer]);
export const env_set = opSimple(opcode.env_set, [], []);
export const env_lin = opSimple(opcode.env_lin, [], []);
export const env_delay = opSimple(opcode.env_delay, [], []);
