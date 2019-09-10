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
  type: Type;
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
    type: Type;
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
          const outputs = getOutputs(definition);
          if (outputs.length != 1) {
            throw new AssertionError('variable is not single valued', {
              count: outputs.length,
            });
          }
          variableInfo.set(name, {
            useCount: 1,
            value: definition,
            type: outputs[0],
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
          if (info.useCount > 0 && info.type == Type.Buffer) {
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
      value.operator == scalarParam ||
      value.operator == bufferParam ||
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
function getOutputs(node: Node): readonly Type[] {
  switch (node.kind) {
    case Kind.Value:
      return node.operator.outputs(node.params);
    case Kind.Variable:
      return [node.type];
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
        `but requires ${typeList(indecls)}`,
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
  type: Type,
): VariableNode {
  return {
    sourceStart: expr.sourceStart,
    sourceEnd: expr.sourceEnd,
    kind: Kind.Variable,
    name,
    type,
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

// Numeric values
export const num_lin = opConstant(opcode.num_lin);
export const num_expo = opConstant(opcode.num_expo);
export const num_note = opConstant(opcode.num_note);
export const num_freq = opConstant(opcode.num_freq);

// Oscillators and generators
export const oscillator = opSimple(
  opcode.oscillator,
  [Type.Buffer],
  [Type.Buffer],
);
export const sawtooth = opSimple(opcode.sawtooth, [Type.Buffer], [Type.Buffer]);
export const sine = opSimple(opcode.sine, [Type.Buffer], [Type.Buffer]);
export const noise = opSimple(opcode.noise, [], [Type.Buffer]);

// Filters
export const highPass = opSimple(opcode.highPass, [Type.Buffer], [Type.Buffer]);
export const stateVariableFilter = opSimple(
  opcode.stateVariableFilter,
  [Type.Buffer, Type.Buffer],
  [Type.Buffer],
);

// Distortion
export const saturate = opSimple(opcode.saturate, [Type.Buffer], [Type.Buffer]);
export const rectify = opSimple(opcode.rectify, [Type.Buffer], [Type.Buffer]);

// Envelopes
export const env_start = opSimple(opcode.env_start, [], []);
export const env_end = opSimple(opcode.env_end, [], [Type.Buffer]);
export const env_set = opSimple(opcode.env_set, [], []);
export const env_lin = opSimple(opcode.env_lin, [], []);
export const env_delay = opSimple(opcode.env_delay, [], []);

// Utilities
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
export const mix = opSimple(
  opcode.mix,
  [Type.Buffer, Type.Buffer],
  [Type.Buffer],
);
export const zero = opSimple(opcode.zero, [], [Type.Buffer]);
export const scaleInt = opSimple(opcode.scaleInt, [Type.Buffer], [Type.Buffer]);

// Parameter references
export const scalarParam = opSimple(opcode.deref, [], [Type.Scalar]);
export const bufferParam = opSimple(opcode.derefCopy, [], [Type.Buffer]);
export const note = opSimple(opcode.note, [], [Type.Buffer]);
