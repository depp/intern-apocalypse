/**
 * S-expression evaluation.
 */

import * as data from './data';
import { toDataClamp, dataMax } from '../lib/data.encode';
import { AssertionError } from '../debug/debug';
import {
  SExpr,
  ListExpr,
  NumberExpr,
  prefixes,
  NumberKind,
} from '../lib/sexpr';
import { SourceError, SourceSpan, noSourceLocation } from '../lib/sourcepos';
import {
  Operator,
  Node,
  Program,
  createNode,
  createVariableRef,
  Type,
} from './node';
import * as node from './node';
import { Units, UnitError, multiplyUnits } from './units';
import { sampleRate } from './engine';

// =============================================================================
// Types
// =============================================================================

/** Kinds of values returned by expressions. */
enum ValueKind {
  Constant,
  Node,
  Void,
}

/** The type of an evaluated value. */
interface ValueType {
  units: Units;
  type: Type;
}

/** A compile-time constant value. */
interface ConstantValue extends SourceSpan {
  kind: ValueKind.Constant;
  value: number;
  units: Units;
  numberKind: NumberKind;
}

function constantValue(
  loc: SourceSpan,
  value: number,
  units: Units,
  numberKind: NumberKind,
): ConstantValue {
  return {
    sourceStart: loc.sourceStart,
    sourceEnd: loc.sourceEnd,
    kind: ValueKind.Constant,
    value,
    units,
    numberKind,
  };
}

/** A node value, the result of evaluating an expression at run-time. */
interface NodeValue extends SourceSpan {
  kind: ValueKind.Node;
  node: Node;
  units: Units;
  type: Type;
}

function nodeValue(node: Node, units: Units, type: Type): NodeValue {
  return {
    sourceStart: node.sourceStart,
    sourceEnd: node.sourceEnd,
    kind: ValueKind.Node,
    node,
    units,
    type,
  };
}

/** A void value, the result of evaluating a statement. */
interface VoidValue extends SourceSpan {
  kind: ValueKind.Void;
}

function voidValue(loc: SourceSpan): VoidValue {
  return {
    sourceStart: loc.sourceStart,
    sourceEnd: loc.sourceEnd,
    kind: ValueKind.Void,
  };
}

type Value = ConstantValue | NodeValue;
type MaybeValue = Value | VoidValue;

/** Format a type for humans. */
function printType(valtype: ValueType): string {
  const { units, type } = valtype;
  return `${Type[type]}(${Units[units]})`;
}

/** Format the type of a value for humans. */
function printValueType(value: MaybeValue): string {
  switch (value.kind) {
    case ValueKind.Node:
      return printType(value);
    case ValueKind.Constant:
      return `Constant(${Units[value.units]})`;
    case ValueKind.Void:
      return 'Void';
    default:
      const dummy: never = value;
      throw new AssertionError('invalid value kind');
  }
}

/** An error during evaluation of a synthesizer program. */
class EvaluationError extends SourceError {}

/** Evaluation environment. */
interface Environment {
  /** Map from variables to their values. */
  variables: Map<string, Value>;
}

// =============================================================================
// Evaluation
// =============================================================================

/**
 * A definition of a Lisp operator. Takes an S-expression as input and returns
 * the processing graph output, with units.
 */
type OperatorDefinition = (env: Environment, expr: ListExpr) => MaybeValue;

/** All Lisp functions, by name. */
const operators = new Map<string, OperatorDefinition>();

/** A numeric value in a program. */
interface Number {
  value: number;
  units: Units;
}

/** Get the value of a numeric literal. */
function getNumber(expr: NumberExpr): ConstantValue {
  let value: number;
  let { numberKind } = expr;
  switch (expr.numberKind) {
    case NumberKind.Integer:
      value = parseInt(expr.value, 10);
      if (!isFinite(value)) {
        throw new EvaluationError(expr, 'could not parse integer');
      }
      break;
    case NumberKind.Decimal:
      value = parseFloat(expr.value);
      if (!isFinite(value)) {
        throw new EvaluationError(expr, 'could not parse decimal');
      }
      break;
    default:
      throw new AssertionError(`unknown number kind ${NumberKind[numberKind]}`);
  }
  if (expr.prefix != '') {
    const factor = prefixes.get(expr.prefix);
    if (factor == null) {
      throw new EvaluationError(
        expr,
        `unknown SI prefix ${JSON.stringify(expr.prefix)}`,
      );
    }
    value *= factor;
    numberKind = NumberKind.Decimal;
  }
  let units: Units;
  switch (expr.units) {
    case '':
      units = Units.None;
      break;
    case 'Hz':
      units = Units.Hertz;
      break;
    case 's':
      units = Units.Second;
      break;
    case 'dB':
      if (expr.prefix != '') {
        throw new EvaluationError(expr, 'dB cannot have an SI prefix');
      }
      units = Units.Decibel;
      break;
    default:
      throw new EvaluationError(
        expr,
        `unknown units ${JSON.stringify(expr.units)}`,
      );
  }
  return constantValue(expr, value, units, numberKind);
}

/** Evaluate a Lisp expression, returning node graph. */
function evaluate(env: Environment, expr: SExpr): MaybeValue {
  switch (expr.type) {
    case 'list':
      if (!expr.items.length) {
        throw new EvaluationError(expr, 'cannot evaluate empty list');
      }
      const opexpr = expr.items[0];
      let opname: string;
      switch (opexpr.type) {
        case 'list':
          throw new EvaluationError(expr, 'cannot use expression as function');
        case 'symbol':
          opname = opexpr.name;
          break;
        case 'number':
          throw new EvaluationError(expr, 'cannot use number as function');
        default:
          const dummy: never = opexpr;
          throw new Error('invalid S-expression type');
      }
      const definition = operators.get(opname);
      if (definition == null) {
        throw new EvaluationError(
          opexpr,
          `no such function ${JSON.stringify(opname)}`,
        );
      }
      return definition(env, expr);
    case 'symbol':
      const { name } = expr;
      const value = env.variables.get(name);
      if (value == null) {
        throw new EvaluationError(
          expr,
          `undefined variable ${JSON.stringify(name)}`,
        );
      }
      switch (value.kind) {
        case ValueKind.Constant:
          return constantValue(
            value,
            value.value,
            value.units,
            value.numberKind,
          );
        case ValueKind.Node:
          return nodeValue(
            createVariableRef(expr, name, value.type),
            value.units,
            value.type,
          );
        default:
          const dummy: never = value;
          throw new AssertionError('unknown value kind');
      }
    case 'number':
      return getNumber(expr);
    default:
      const dummy: never = expr;
      throw new AssertionError('invalid S-expression type');
  }
}

/**
 * Program input parameter specification. Used to define the API for executing
 * a program.
 */
export interface Parameter {
  readonly name: string;
  readonly units: Units;
  readonly type: Type;
}

/** Parameter definitions for sound generators. */
export const soundParameters: readonly Parameter[] = [
  { name: 'note-value', units: Units.Note, type: Type.Scalar },
];

/** Evaluate a synthesizer program and return the graph. */
export function evaluateProgram(
  program: SExpr[],
  params: readonly Parameter[],
): Program {
  if (program.length == 0) {
    throw new EvaluationError(noSourceLocation, 'empty program');
  }

  // Define initial environment.
  const env: Environment = {
    variables: new Map<string, Value>(),
  };
  for (let i = 0; i < params.length; i++) {
    const { name, units, type } = params[i];
    if (env.variables.has(name)) {
      throw new EvaluationError(
        noSourceLocation,
        `duplicate parameter ${JSON.stringify(name)}`,
      );
    }
    let op: Operator;
    switch (type) {
      case Type.Scalar:
        op = node.scalarParam;
        break;
      case Type.Buffer:
        op = node.bufferParam;
        break;
      default:
        const dummy: never = type;
        throw new AssertionError('unknown type');
    }
    env.variables.set(
      name,
      nodeValue(createNode(noSourceLocation, op, [i], []), units, type),
    );
  }

  // Evaluate top-level forms.
  for (let i = 0; i < program.length - 1; i++) {
    const value = evaluate(env, program[i]);
    if (value.kind != ValueKind.Void) {
      throw new EvaluationError(value, 'expected statement, got expression');
    }
  }
  const value = evaluate(env, program[program.length - 1]);
  if (
    value.kind != ValueKind.Node ||
    value.units != Units.Volt ||
    value.type != Type.Buffer
  ) {
    throw new EvaluationError(
      value,
      `program has type ${printValueType(value)}, expected Buffer(Volt)`,
    );
  }

  // Collect variables.
  const variables = new Map<string, Node>();
  for (const [name, value] of env.variables) {
    switch (value.kind) {
      case ValueKind.Node:
        variables.set(name, value.node);
        break;
      case ValueKind.Constant:
        break;
      default:
        const dummy: never = value;
        throw new AssertionError('unknown value kind');
    }
  }
  return {
    parameterCount: params.length,
    variables,
    result: value.node,
  };
}

/** Define a Lisp operator. */
function define(name: string, compile: OperatorDefinition): void {
  if (operators.has(name)) {
    throw new AssertionError(
      `operator ${JSON.stringify(name)} is already defined`,
    );
  }
  operators.set(name, compile);
}

/** Wrap a value with a 1-input, 1-output operator.. */
function wrapNode(node: Node, operator: Operator): Node {
  return createNode(node, operator, [], [node]);
}

/** Throw an exception for a bad argument type. */
function badArgType(
  name: string,
  value: MaybeValue,
  expected: string,
): EvaluationError {
  throw new EvaluationError(
    value,
    `invalid type for argument ${JSON.stringify(name)}: ` +
      `type is ${printValueType(value)}, expected ${expected}`,
  );
}

/** Get a scalar compile-time constant. */
function getConstant(name: string, value: MaybeValue, units: Units): number {
  if (value.kind != ValueKind.Constant || value.units != units) {
    throw badArgType(name, value, `Constant(${Units[units]})`);
  }
  return value.value;
}

/** Get a unitless integer value. */
function getInteger(name: string, value: Value): number {
  if (
    value.kind != ValueKind.Constant ||
    value.units != Units.None ||
    value.numberKind != NumberKind.Integer
  ) {
    throw badArgType(name, value, `Integer Constant(None)`);
  }
  return value.value;
}

/** Get a gain compile-time constant. */
function getGain(name: string, value: MaybeValue): number {
  if (value.kind == ValueKind.Constant) {
    switch (value.units) {
      case Units.None:
        return value.value;
      case Units.Decibel:
        return 10 ** (value.value / 20);
    }
  }
  throw badArgType(name, value, 'Constant(None) or Constant(Decibel)');
}

/** Accept exactly one type. */
function getExact(name: string, value: Value, units: Units, type: Type): Node {
  if (
    value.kind == ValueKind.Node &&
    value.units == units &&
    value.type == type
  ) {
    return value.node;
  }
  throw badArgType(name, value, printType({ units, type }));
}

/** Accept a scalar with the given units. */
function getScalar(name: string, value: Value, units: Units): Node {
  return getExact(name, value, units, Type.Scalar);
}

/** Accept a buffer with the given units. */
function getBuffer(name: string, value: Value, units: Units): Node {
  return getExact(name, value, units, Type.Buffer);
}

/** Accept any scalar type. */
function getAnyScalar(name: string, value: Value): Node {
  if (value.kind == ValueKind.Node && value.type == Type.Scalar) {
    return value.node;
  }
  throw badArgType(name, value, 'Scalar(any)');
}

/** Accept any buffer type. */
function getAnyBuffer(name: string, value: Value): Node {
  if (value.kind == ValueKind.Node && value.type == Type.Buffer) {
    return value.node;
  }
  throw badArgType(name, value, 'Buffer(any)');
}

/** Accept a buffer or scalar with the given units. */
function castToBuffer(name: string, value: Value, units: Units): Node {
  if (value.kind == ValueKind.Node && value.units == units) {
    switch (value.type) {
      case Type.Scalar:
        return wrapNode(value.node, node.constant);
      case Type.Buffer:
        return value.node;
    }
  }
  const ustr = Units[units];
  throw badArgType(name, value, `Scalar(${ustr}) or Buffer(${ustr})`);
}

/**
 * Accept a buffer containing phase data, or create it from frequency scalar or
 * buffer.
 */
function castToPhase(name: string, value: Value): Node {
  switch (value.kind) {
    case ValueKind.Constant:
      const vnode = createNode(
        value,
        node.num_freq,
        [toDataClamp(data.encodeFrequency(value.value))],
        [],
      );
      const frequency = wrapNode(vnode, node.constant);
      return wrapNode(frequency, node.oscillator);
    case ValueKind.Node:
      switch (value.units) {
        case Units.Phase:
          if (value.type == Type.Buffer) {
            return value.node;
          }
          break;
        case Units.Hertz:
          switch (value.type) {
            case Type.Scalar:
              const frequency = wrapNode(value.node, node.constant);
              return wrapNode(frequency, node.oscillator);
            case Type.Buffer:
              return wrapNode(value.node, node.oscillator);
          }
          break;
      }
      break;
  }
  throw badArgType(
    name,
    value,
    'Buffer(Volt), Constant(Hertz), Scalar(Hertz), or Buffer(Hertz)',
  );
}

/** Return an error fon an unexpected void value. */
function expectNonVoid(value: VoidValue): EvaluationError {
  return new EvaluationError(
    value,
    'expected a value, but the expression has no value',
  );
}

/**
 * Function definition type, operates on the node graph and returns a new node.
 */
type FunctionDefinition = (expr: ListExpr, args: Value[]) => Value;

/**
 * Define a function. A function is just an operator that evaluates all of its
 * arguments.
 */
function defun(name: string, evaluateFunction: FunctionDefinition): void {
  define(name, (env: Environment, expr: ListExpr): Value => {
    const args: Value[] = [];
    for (let i = 1; i < expr.items.length; i++) {
      const value = evaluate(env, expr.items[i]);
      if (value.kind == ValueKind.Void) {
        throw expectNonVoid(value);
      }
      args.push(value);
    }
    try {
      return evaluateFunction(expr, args);
    } catch (e) {
      if (e instanceof EvaluationError) {
        e.message = `in call to function ${JSON.stringify(name)}: ${e.message}`;
      }
      throw e;
    }
  });
}

function getExactArgs(expr: ListExpr, args: Value[], count: number): Value[] {
  if (args.length != count) {
    throw new EvaluationError(
      expr,
      `got ${args.length} arguments, but need ${count}`,
    );
  }
  return args;
}

// =============================================================================
// Parameters
// =============================================================================

defun('note', (expr, args) => {
  const [offsetExpr] = getExactArgs(expr, args, 1);
  const offset = getInteger('offset', offsetExpr);
  const zero = 48;
  const min = -zero;
  const max = dataMax - zero;
  if (offset < min || max < offset) {
    throw new EvaluationError(
      offsetExpr,
      `offset ${offset} ouf of range, ` + `must be in the range ${min}-${max}`,
    );
  }
  return nodeValue(
    createNode(expr, node.note, [offset + zero], []),
    Units.Hertz,
    Type.Buffer,
  );
});

// =============================================================================
// Oscillators and generators
// =============================================================================

defun('oscillator', (expr, args) => {
  const [frequency] = getExactArgs(expr, args, 1);
  return nodeValue(
    createNode(
      expr,
      node.oscillator,
      [],
      [castToBuffer('frequency', frequency, Units.Hertz)],
    ),
    Units.Phase,
    Type.Buffer,
  );
});

defun('sawtooth', (expr, args) => {
  const [phase] = getExactArgs(expr, args, 1);
  return nodeValue(
    createNode(expr, node.sawtooth, [], [castToPhase('phase', phase)]),
    Units.Volt,
    Type.Buffer,
  );
});

defun('sine', (expr, args) => {
  const [phase] = getExactArgs(expr, args, 1);
  return nodeValue(
    createNode(expr, node.sine, [], [castToPhase('phase', phase)]),
    Units.Volt,
    Type.Buffer,
  );
});

defun('noise', (expr, args) => {
  getExactArgs(expr, args, 0);
  return nodeValue(
    createNode(expr, node.noise, [], []),
    Units.Volt,
    Type.Buffer,
  );
});

// =============================================================================
// Filters
// =============================================================================

defun('highPass', (expr, args) => {
  const [frequency, input] = getExactArgs(expr, args, 2);
  const fval = getConstant('frequency', frequency, Units.Hertz);
  // We calculate the coefficient here, not in the engine.
  const coeff = Math.sin((2 * Math.PI * fval) / sampleRate);
  return nodeValue(
    createNode(
      expr,
      node.highPass,
      [toDataClamp(data.encodeFrequency(coeff * sampleRate))],
      [getBuffer('input', input, Units.Volt)],
    ),
    Units.Volt,
    Type.Buffer,
  );
});

['lowPass2', 'highPass2', 'bandPass2'].forEach((name, mode) =>
  defun(name, (expr, args) => {
    const [input, frequency, q] = getExactArgs(expr, args, 3);
    const qval = getConstant('q', q, Units.None);
    if (qval < 0.7) {
      throw new EvaluationError(q, `q is ${qval}, must be >= 0.7`);
    }
    return nodeValue(
      createNode(
        expr,
        node.stateVariableFilter,
        [mode, toDataClamp(data.encodeExponential(1 / qval))],
        [
          getAnyBuffer('input', input),
          castToBuffer('frequency', frequency, Units.Hertz),
        ],
      ),
      input.units,
      Type.Buffer,
    );
  }),
);

// =============================================================================
// Distortion
// =============================================================================

defun('saturate', (expr, args) => {
  const [input] = getExactArgs(expr, args, 1);
  return nodeValue(
    createNode(
      expr,
      node.saturate,
      [],
      [getBuffer('input', input, Units.Volt)],
    ),
    Units.Volt,
    Type.Buffer,
  );
});

defun('rectify', (expr, args) => {
  const [input] = getExactArgs(expr, args, 1);
  return nodeValue(
    createNode(expr, node.rectify, [], [getBuffer('input', input, Units.Volt)]),
    Units.Volt,
    Type.Buffer,
  );
});

// =============================================================================
// Utilities
// =============================================================================

defun('*', (expr, args) => {
  if (args.length < 2) {
    throw new EvaluationError(
      expr,
      `got ${args.length} arguments, but need 2 or more`,
    );
  }
  const argUnits: Units[] = [];
  const buffers: Node[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.kind == ValueKind.Node && arg.type == Type.Buffer) {
      buffers.push(arg.node);
    } else {
      throw badArgType(`arg${i}`, arg, 'Buffer');
    }
    argUnits.push(arg.units);
  }
  let units: Units;
  try {
    units = multiplyUnits(argUnits);
  } catch (e) {
    if (e instanceof UnitError) {
      throw new EvaluationError(
        expr,
        `cannot determine units for result: ${e.message}`,
      );
    }
    throw e;
  }
  let result = buffers[0];
  for (let i = 1; i < buffers.length; i++) {
    result = createNode(expr, node.multiply, [], [result, buffers[i]]);
  }
  return nodeValue(result, units, Type.Buffer);
});

defun('constant', (expr, args) => {
  const [value] = getExactArgs(expr, args, 1);
  return nodeValue(
    createNode(expr, node.constant, [], [getAnyScalar('value', value)]),
    value.units,
    Type.Buffer,
  );
});

defun('frequency', (expr, args) => {
  const [input] = getExactArgs(expr, args, 1);
  return nodeValue(
    createNode(
      expr,
      node.frequency,
      [],
      [getBuffer('input', input, Units.None)],
    ),
    Units.Hertz,
    Type.Buffer,
  );
});

defun('mix', (expr, args) => {
  if ((args.length & 1) != 0) {
    throw new EvaluationError(
      expr,
      `mix got ${args.length} arguments, requires an even number`,
    );
  }
  const count = args.length / 2;
  let output = createNode(expr, node.zero, [], []);
  for (let i = 0; i < count; i++) {
    const gain = getGain(`gain${i}`, args[i * 2]);
    output = createNode(
      expr,
      node.mix,
      [toDataClamp(data.encodeExponential(gain))],
      [output, getBuffer(`audio${i}`, args[i * 2 + 1], Units.Volt)],
    );
  }
  return nodeValue(output, Units.Volt, Type.Buffer);
});

defun('phase-mod', (expr, args) => {
  if ((args.length & 1) != 1) {
    throw new EvaluationError(
      expr,
      `phase-mod got ${args.length} arguments, requires an odd number`,
    );
  }
  let output = castToPhase('phase', args[0]);
  const count = (args.length - 1) / 2;
  for (let i = 0; i < count; i++) {
    const amount = getGain(`amount${i}`, args[i * 2 + 1]);
    const mod = getBuffer(`mod${i}`, args[i * 2 + 2], Units.Volt);
    output = createNode(
      expr,
      node.mix,
      [toDataClamp(data.encodeExponential(amount))],
      [output, mod],
    );
  }
  return nodeValue(output, Units.Phase, Type.Buffer);
});

defun('overtone', (expr, args) => {
  const [nvalue, input] = getExactArgs(expr, args, 2);
  const n = getInteger('n', nvalue);
  if (n < 1 || n > dataMax) {
    throw new EvaluationError(
      nvalue,
      `overtone index is ${n}, must be in the range 1-${dataMax}`,
    );
  }
  return nodeValue(
    createNode(expr, node.scaleInt, [n], [castToPhase('phase', input)]),
    Units.Phase,
    Type.Buffer,
  );
});

// =============================================================================
// Envelope
// =============================================================================

type EnvelopeSegment = (expr: ListExpr, args: Value[]) => Node;

const envelopeOperators = new Map<string, EnvelopeSegment>();

function defenv(name: string, evaluateFunction: EnvelopeSegment): void {
  envelopeOperators.set(name, evaluateFunction);
}

function evaluateEnv(env: Environment, expr: SExpr): Node {
  if (expr.type != 'list') {
    throw new EvaluationError(expr, 'envelope segment must be a list');
  }
  if (!expr.items.length) {
    throw new EvaluationError(expr, 'cannot evaluate empty list');
  }
  const opexpr = expr.items[0];
  let opname: string;
  switch (opexpr.type) {
    case 'list':
      throw new EvaluationError(expr, 'cannot use expression as function');
    case 'symbol':
      opname = opexpr.name;
      break;
    case 'number':
      throw new EvaluationError(expr, 'cannot use number as function');
    default:
      const dummy: never = opexpr;
      throw new Error('invalid S-expression type');
  }
  const evaluateFunction = envelopeOperators.get(opname);
  if (evaluateFunction == null) {
    throw new EvaluationError(
      opexpr,
      `no such envelope operator ${JSON.stringify(opname)}`,
    );
  }
  const args: Value[] = [];
  for (let i = 1; i < expr.items.length; i++) {
    const value = evaluate(env, expr.items[i]);
    if (value.kind == ValueKind.Void) {
      throw expectNonVoid(value);
    }
    args.push(value);
  }
  try {
    return evaluateFunction(expr, args);
  } catch (e) {
    if (e instanceof EvaluationError) {
      e.message = `in call to function ${JSON.stringify(opname)}: ${e.message}`;
    }
    throw e;
  }
}

define('envelope', (env, expr) => {
  const nodes: Node[] = [createNode(expr, node.env_start, [], [])];
  for (let i = 1; i < expr.items.length; i++) {
    nodes.push(evaluateEnv(env, expr.items[i]));
  }
  return nodeValue(
    createNode(expr, node.env_end, [], nodes),
    Units.None,
    Type.Buffer,
  );
});

defenv('set', (expr, args) => {
  let [valueValue] = getExactArgs(expr, args, 1);
  const valueParam = toDataClamp(
    data.encodeLinear(getConstant('value', valueValue, Units.None)),
  );
  return createNode(expr, node.env_set, [valueParam], []);
});

defenv('lin', (expr, args) => {
  let [timeValue, valueValue] = getExactArgs(expr, args, 2);
  const timeParam = toDataClamp(
    data.encodeExponential(getConstant('time', timeValue, Units.Second)),
  );
  const valueParam = toDataClamp(
    data.encodeLinear(getConstant('value', valueValue, Units.None)),
  );
  return createNode(expr, node.env_lin, [timeParam, valueParam], []);
});

defenv('delay', (expr, args) => {
  let [timeValue] = getExactArgs(expr, args, 1);
  const timeParam = toDataClamp(
    data.encodeExponential(getConstant('time', timeValue, Units.Second)),
  );
  return createNode(expr, node.env_delay, [timeParam], []);
});

// =============================================================================
// Variables
// =============================================================================

define('define', (env: Environment, expr: ListExpr): MaybeValue => {
  const count = expr.items.length - 1;
  if (count != 2) {
    throw new EvaluationError(
      expr,
      `define got ${count} arguments, but needs 2`,
    );
  }
  const [, nameExpr, valueExpr] = expr.items;
  if (nameExpr.type != 'symbol') {
    throw new EvaluationError(nameExpr, 'variable name must be a symbol');
  }
  const { name } = nameExpr;
  const value = evaluate(env, valueExpr);
  if (value.kind == ValueKind.Void) {
    throw expectNonVoid(value);
  }
  const { variables } = env;
  const existing = variables.get(name);
  if (existing) {
    throw new EvaluationError(
      nameExpr,
      `a variable named ${JSON.stringify(name)} is already defined`,
    );
  }
  variables.set(name, value);
  return voidValue(expr);
});
