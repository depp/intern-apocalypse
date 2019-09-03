/**
 * S-expression evaluation.
 */

import * as data from './data';
import { AssertionError } from '../debug/debug';
import { SExpr, ListExpr, NumberExpr, prefixes } from '../lib/sexpr';
import { SourceError, SourceSpan } from '../lib/sourcepos';
import { Operator, Node, createNode, Type } from './node';
import * as node from './node';
import { Units, UnitError, multiplyUnits } from './units';

/** Kinds of values returned by expressions. */
enum ValueKind {
  Constant,
  Node,
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
}

function constantValue(
  loc: SourceSpan,
  value: number,
  units: Units,
): ConstantValue {
  return {
    sourceStart: loc.sourceStart,
    sourceEnd: loc.sourceEnd,
    kind: ValueKind.Constant,
    value,
    units,
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

type Value = ConstantValue | NodeValue;

/** Format a type for humans. */
function printType(valtype: ValueType): string {
  const { units, type } = valtype;
  return `${Type[type]}(${Units[units]})`;
}

/** Format the type of a value for humans. */
function printValueType(value: Value): string {
  switch (value.kind) {
    case ValueKind.Node:
      return printType(value);
    case ValueKind.Constant:
      return `Constant(${Units[value.units]})`;
    default:
      const dummy: never = value;
      throw new AssertionError('invalid value kind');
  }
}

/** An error during evaluation of a synthesizer program. */
class EvaluationError extends SourceError {
  constructor(node: SourceSpan, message: string) {
    super(node.sourceStart, node.sourceEnd, message);
  }
}

/**
 * A definition of a Lisp operator. Takes an S-expression as input and returns
 * the processing graph output, with units.
 */
type OperatorDefinition = (expr: ListExpr) => Value;

/** All Lisp functions, by name. */
const operators = new Map<string, OperatorDefinition>();

/** A numeric value in a program. */
interface Number {
  value: number;
  units: Units;
}

/** Get the value of a numeric literal. */
function getNumber(expr: NumberExpr): ConstantValue {
  let value = parseFloat(expr.value);
  if (isNaN(value)) {
    throw new EvaluationError(expr, 'could not parse numeric constant');
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
  return constantValue(expr, value, units);
}

/** Quantize and clamp a number for inclusion in the data stream. */
function toData(x: number): number {
  const y = Math.round(x);
  if (y < 0) {
    return 0;
  } else if (y > data.dataMax) {
    return data.dataMax;
  } else {
    return y;
  }
}

/** Evaluate a Lisp expression, returning node graph. */
function evaluate(expr: SExpr): Value {
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
      return definition(expr);
    case 'symbol':
      throw new EvaluationError(expr, 'cannot evaluate symbol');
    case 'number':
      return getNumber(expr);
    default:
      const dummy: never = expr;
      throw new AssertionError('invalid S-expression type');
  }
}

/** Evaluate a synthesizer program and return the graph. */
export function evaluateProgram(program: SExpr[]): Node {
  if (program.length != 1) {
    if (program.length == 0) {
      throw new EvaluationError(
        { sourceStart: 0, sourceEnd: 0 },
        'empty program',
      );
    }
    throw new EvaluationError(program[1], 'too many top-level expressions');
  }
  const value = evaluate(program[0]);
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
  return value.node;
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
  value: Value,
  expected: string,
): EvaluationError {
  throw new EvaluationError(
    value,
    `invalid type for argument ${JSON.stringify(name)}: ` +
      `type is ${printValueType(value)}, expected ${expected}`,
  );
}

/** Get a scalar compile-time constant. */
function getConstant(name: string, value: Value, units: Units): number {
  if (value.kind != ValueKind.Constant || value.units != units) {
    throw badArgType(name, value, `Constant(${Units[units]})`);
  }
  return value.value;
}

/** Get a gain compile-time constant. */
function getGain(name: string, value: Value): number {
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
        [toData(data.encodeFrequency(value.value))],
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

/**
 * Define a function. A function is just an operator that evaluates all of its
 * arguments.
 */
function defun(
  name: string,
  evaluateFunction: (expr: ListExpr, args: Value[]) => Value,
): void {
  define(name, function(expr: ListExpr): Value {
    const args: Value[] = [];
    for (let i = 1; i < expr.items.length; i++) {
      args.push(evaluate(expr.items[i]));
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
// Constant definitions
// =============================================================================

defun('note', (expr, args) => {
  const [frequency] = getExactArgs(expr, args, 1);
  const fvalue = getConstant('frequency', frequency, Units.Hertz);
  return nodeValue(
    createNode(expr, node.num_note, [toData(data.encodeNote(fvalue))], []),
    Units.Hertz,
    Type.Scalar,
  );
});

// =============================================================================
// Operator definitions
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

defun('lowPass2', (expr, args) => {
  const [input, frequency, q] = getExactArgs(expr, args, 3);
  const qval = getConstant('q', q, Units.None);
  if (qval < 0.7) {
    throw new EvaluationError(q, `q is ${qval}, must be >= 0.7`);
  }
  return nodeValue(
    createNode(
      expr,
      node.lowPass2,
      [toData(data.encodeExponential(1 / qval))],
      [
        getAnyBuffer('input', input),
        castToBuffer('frequency', frequency, Units.Hertz),
      ],
    ),
    input.units,
    Type.Buffer,
  );
});

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
      [toData(data.encodeExponential(gain))],
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
      [toData(data.encodeExponential(amount))],
      [output, mod],
    );
  }
  return nodeValue(output, Units.Phase, Type.Buffer);
});

// =============================================================================
// Envelope
// =============================================================================

type EnvelopeSegment = (expr: ListExpr, args: Value[]) => Node;

const envelopeOperators = new Map<string, EnvelopeSegment>();

function defenv(name: string, evaluateFunction: EnvelopeSegment): void {
  envelopeOperators.set(name, evaluateFunction);
}

function evaluateEnv(expr: SExpr): Node {
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
    args.push(evaluate(expr.items[i]));
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

define('envelope', expr => {
  const nodes: Node[] = [createNode(expr, node.env_start, [], [])];
  for (let i = 1; i < expr.items.length; i++) {
    nodes.push(evaluateEnv(expr.items[i]));
  }
  return nodeValue(
    createNode(expr, node.env_end, [], nodes),
    Units.None,
    Type.Buffer,
  );
});

defenv('set', (expr, args) => {
  let [valueValue] = getExactArgs(expr, args, 1);
  const valueParam = toData(
    data.encodeLinear(getConstant('value', valueValue, Units.None)),
  );
  return createNode(expr, node.env_set, [valueParam], []);
});

defenv('lin', (expr, args) => {
  let [timeValue, valueValue] = getExactArgs(expr, args, 2);
  const timeParam = toData(
    data.encodeExponential(getConstant('time', timeValue, Units.Second)),
  );
  const valueParam = toData(
    data.encodeLinear(getConstant('value', valueValue, Units.None)),
  );
  return createNode(expr, node.env_lin, [timeParam, valueParam], []);
});

defenv('delay', (expr, args) => {
  let [timeValue] = getExactArgs(expr, args, 1);
  const timeParam = toData(
    data.encodeExponential(getConstant('time', timeValue, Units.Second)),
  );
  return createNode(expr, node.env_delay, [timeParam], []);
});
