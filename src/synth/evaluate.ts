/**
 * S-expression evaluation.
 */

import * as data from './data';
import { AssertionError } from '../debug';
import { SExpr, ListExpr, parseSExpr, NumberExpr, prefixes } from '../sexpr';
import { SourceError, SourceSpan } from '../sourcepos';
import { Operator, Node, createNode, Type } from './node';
import * as node from './node';
import { Units, UnitError, multiplyUnits } from './units';

/** The type of an evaluated valu. */
interface ValueType {
  units: Units;
  type: Type;
}

/** A value, the result of evaluating an expression. */
interface Value extends ValueType {
  node: Node;
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
function getNumber(expr: NumberExpr): Number {
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
    default:
      throw new EvaluationError(
        expr,
        `unknown units ${JSON.stringify(expr.units)}`,
      );
  }
  return { value, units };
}

/** A way of encoding a compile-time constant as a value. */
interface Encoding {
  decodedUnits: Units;
  encodedUnits: Units;
  operator: Operator;
  encode(x: number): number;
  decode(x: number): number;
}

const encodings: Encoding[] = [
  {
    decodedUnits: Units.None,
    encodedUnits: Units.None,
    operator: node.num_lin,
    encode: data.encodeLinear,
    decode: data.decodeLinear,
  },
  {
    decodedUnits: Units.Hertz,
    encodedUnits: Units.Hertz,
    operator: node.num_note,
    encode: data.encodeNote,
    decode: data.decodeNote,
  },
  {
    decodedUnits: Units.Second,
    encodedUnits: Units.Second,
    operator: node.num_time,
    encode: data.encodeTime,
    decode: data.decodeTime,
  },
];

/** Emit a compile-time numeric constant. */
function evaluateNumber(expr: SExpr, num: Number): Value {
  const { value, units } = num;
  for (const einfo of encodings) {
    if (einfo.decodedUnits == units) {
      let encoded = Math.round(einfo.encode(value));
      if (encoded < 0) {
        encoded = 0;
      } else if (encoded > data.dataMax) {
        encoded = data.dataMax;
      }
      return {
        node: createNode(expr, einfo.operator, [encoded], []),
        units: einfo.encodedUnits,
        type: Type.Scalar,
      };
    }
  }
  throw new EvaluationError(
    expr,
    `could not encode number with units ${Units[units]}`,
  );
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
      const num = getNumber(expr);
      return evaluateNumber(expr, num);
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
  if (value.units != Units.Volt || value.type != Type.Buffer) {
    throw new EvaluationError(
      value.node,
      `program has type ${printType(value)}, ` + 'expected Buffer(Volt)',
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

/** Format a value type for humans. */
function printType(valtype: ValueType): string {
  const { units, type } = valtype;
  return `${Type[type]}(${Units[units]})`;
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
    value.node,
    `invalid type for argument ${JSON.stringify(name)}: ` +
      `type is ${printType(value)}, ` +
      `expected ${expected}`,
  );
}

/** Accept exactly one type. */
function getExact(name: string, value: Value, units: Units, type: Type): Node {
  if (value.units == units && value.type == type) {
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
  if (value.type == Type.Scalar) {
    return value.node;
  }
  throw badArgType(name, value, 'Scalar(any)');
}

/** Accept any buffer type. */
function getAnyBuffer(name: string, value: Value): Node {
  if (value.type == Type.Buffer) {
    return value.node;
  }
  throw badArgType(name, value, 'Buffer(any)');
}

/** Accept a buffer or scalar with the given units. */
function castToBuffer(name: string, value: Value, units: Units): Node {
  if (value.units == units) {
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
  throw badArgType(
    name,
    value,
    'Buffer(Volt), Scalar(Hertz), or Buffer(Hertz)',
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
// Operator definitions
// =============================================================================

defun('oscillator', (expr, args) => {
  const [frequency] = getExactArgs(expr, args, 1);
  return {
    units: Units.Phase,
    type: Type.Buffer,
    node: createNode(
      expr,
      node.oscillator,
      [],
      [castToBuffer('frequency', frequency, Units.Hertz)],
    ),
  };
});

defun('sawtooth', (expr, args) => {
  const [phase] = getExactArgs(expr, args, 1);
  return {
    units: Units.Volt,
    type: Type.Buffer,
    node: createNode(expr, node.sawtooth, [], [castToPhase('phase', phase)]),
  };
});

defun('lowPass2', (expr, args) => {
  const [input, frequency] = getExactArgs(expr, args, 2);
  return {
    units: input.units,
    type: Type.Buffer,
    node: createNode(
      expr,
      node.lowPass2,
      [],
      [
        getAnyBuffer('input', input),
        castToBuffer('frequency', frequency, Units.Hertz),
      ],
    ),
  };
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
  for (const arg of args) {
    if (arg.type == Type.Buffer) {
      buffers.push(arg.node);
    } else {
      throw new EvaluationError(
        arg.node,
        `argument has type ${Type[arg.type]}, expected Buffer`,
      );
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
  return {
    units,
    type: Type.Buffer,
    node: result,
  };
});

defun('constant', (expr, args) => {
  const [value] = getExactArgs(expr, args, 1);
  return {
    units: value.units,
    type: Type.Buffer,
    node: createNode(expr, node.constant, [], [getAnyScalar('value', value)]),
  };
});

defun('envelope', (expr, args) => {
  if ((args.length & 1) != 1) {
    throw new EvaluationError(
      expr,
      `envelope got ${args.length} arguments, ` + 'requires an odd number',
    );
  }
  const size = (args.length - 1) / 2;
  const units = args[0].units;
  const inputs: Node[] = [getAnyScalar('v0', args[0])];
  for (let i = 1; i < size + 1; i++) {
    inputs.push(getScalar('t' + i, args[i * 2 - 1], Units.Second));
    inputs.push(getScalar('v' + i, args[i * 2], units));
  }
  return {
    units,
    type: Type.Buffer,
    node: createNode(expr, node.envelope, [size], inputs),
  };
});
