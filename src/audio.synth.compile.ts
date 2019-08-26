import { CodeEmitter } from './audio.synth.opcode';
import * as opcode from './audio.synth.opcode';
import { AssertionError } from './debug';
import { SExpr, ListExpr, parseSExpr, NumberExpr } from './sexpr';
import { SourceError, SourceSpan } from './sourcepos';

/** An error during compilation of a synthesizer program. */
class CompilationError extends SourceError {
  constructor(node: SourceSpan, message: string) {
    super(node.sourceStart, node.sourceEnd, message);
  }
}

/**
 * A definition of a Lisp operator. Takes an S-expression as input and emits the
 * compiled output.
 */
type OperatorDefinition = (code: CodeEmitter, expr: ListExpr) => void;

/** All Lisp functions, by name. */
const operators = new Map<string, OperatorDefinition>();

/** Get the value of a numeric literal. */
function getNumber(expr: NumberExpr): number {
  const value = parseFloat(expr.value);
  if (isNaN(value)) {
    throw new CompilationError(expr, 'could not parse numeric constant');
  }
  return value;
}

/** Evaluate a Lisp expression which must be a compile-time numeric constant. */
function compileConstantExpr(expr: SExpr): number {
  switch (expr.type) {
    case 'list':
    case 'symbol':
      throw new CompilationError(expr, 'expected a compile-time constant');
    case 'number':
      return getNumber(expr);
    default:
      const dummy: never = expr;
      throw new AssertionError('invalid S-expression type');
  }
}

/** Compile a Lisp expression. */
function compileExpr(ctx: CodeEmitter, expr: SExpr): void {
  switch (expr.type) {
    case 'list':
      if (!expr.items.length) {
        throw new CompilationError(expr, 'cannot evaluate empty list');
      }
      const opexpr = expr.items[0];
      let opname: string;
      switch (opexpr.type) {
        case 'list':
          throw new CompilationError(expr, 'cannot use expression as function');
        case 'symbol':
          opname = opexpr.name;
          break;
        case 'number':
          throw new CompilationError(expr, 'cannot use number as function');
        default:
          const dummy: never = opexpr;
          throw new Error('invalid S-expression type');
      }
      const definition = operators.get(opname);
      if (definition == null) {
        throw new CompilationError(
          opexpr,
          `no such function ${JSON.stringify(opname)}`,
        );
      }
      definition(ctx, expr);
      break;
    case 'symbol':
      throw new CompilationError(expr, 'cannot evaluate symbol');
    case 'number':
      const value = getNumber(expr);
      ctx.emit(opcode.number, value);
      break;
    default:
      const dummy: never = expr;
      throw new AssertionError('invalid S-expression type');
  }
}

/** Information about a function call. */
interface FunctionCall extends SourceSpan {
  /** Function name. */
  name: string;
  /** Number of arguments. */
  count: number;
}

/** Define a Lisp operator. */
function defop(
  name: string,
  compile: (ctx: CodeEmitter, expr: ListExpr) => void,
): void {
  if (operators.has(name)) {
    throw new AssertionError(
      `operator ${JSON.stringify(name)} is already defined`,
    );
  }
  operators.set(name, compile);
}

/** Define a Lisp function. */
function defun(
  name: string,
  compile: (ctx: CodeEmitter, call: FunctionCall) => void,
): void {
  defop(name, (ctx: CodeEmitter, expr: ListExpr): void => {
    const { items } = expr;
    for (let i = 1; i < items.length; i++) {
      compileExpr(ctx, items[i]);
    }
    compile(ctx, {
      sourceStart: expr.sourceStart,
      sourceEnd: expr.sourceEnd,
      name,
      count: items.length - 1,
    });
  });
}

/**
 * Compile an audio program.
 * @param source The program source code.
 * @returns The compiled program instructions as a byte stream.
 */
export function compileProgram(source: string): Uint8Array {
  const exprs = parseSExpr(source);
  const ctx = new CodeEmitter();
  for (const expr of exprs) {
    compileExpr(ctx, expr);
  }
  return ctx.getCode();
}

/** Check that the number of function arguments is equal to a specific value. */
function checkArgs(call: FunctionCall, count: number): void {
  if (call.count != count) {
    throw new CompilationError(
      call,
      `function ${JSON.stringify(call.name)} got ` +
        `${call.count} arguments, but takes ${count}`,
    );
  }
}

// =============================================================================
// Operator definitions
// =============================================================================

defun('oscillator', (ctx, call) => {
  checkArgs(call, 1);
  ctx.emit(opcode.oscillator);
});
defun('sawtooth', (ctx, call) => {
  checkArgs(call, 1);
  ctx.emit(opcode.sawtooth);
});
defun('lowPass2', (ctx, call) => {
  checkArgs(call, 2);
  ctx.emit(opcode.lowPass2);
});
defun('multiply', (ctx, call) => {
  checkArgs(call, 2);
  ctx.emit(opcode.multiply);
});
defun('frequency', (ctx, call) => {
  checkArgs(call, 1);
  ctx.emit(opcode.frequency);
});
defun('gain', (ctx, call) => {
  checkArgs(call, 1);
  ctx.emit(opcode.gain);
});
defun('constant', (ctx, call) => {
  checkArgs(call, 1);
  ctx.emit(opcode.constant);
});
defun('expscale', (ctx, call) => {
  checkArgs(call, 3);
  ctx.emit(opcode.expscale);
});
defun('envelope', (ctx, call) => {
  if ((call.count & 1) != 1) {
    throw new CompilationError(
      call,
      `function ${JSON.stringify(call.name)} got ` +
        `${call.count} arguments, but takes an odd number`,
    );
  }
  ctx.emit(opcode.envelope, (call.count - 1) / 2);
});
