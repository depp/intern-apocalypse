/**
 * S-expression testing script.
 *
 * When run, checks Lisp code for syntax errors and prints the code back out.
 */

import * as fs from 'fs';

import chalk from 'chalk';

import { readStream } from './stream';

import { SExpr, parseSExpr, printSExpr } from '../src/sexpr';
import { SourceSpan, SourceText, SourceError } from '../src/sourcepos';

const colorFilename: (s: string) => string = chalk.cyan;
const colorLoc: (s: string) => string = chalk.yellow;
const colorError: (s: string) => string = chalk.red;
const colorErrorUnderline: (s: string) => string = chalk.red;
const colorLineNumber: (s: string) => string = chalk.inverse;

/**
 * Print an error message.
 */
function showError(text: SourceText, e: Error & SourceSpan): void {
  const start = text.lookup(e.sourceStart);
  const end = text.lookup(e.sourceEnd);
  process.stderr.write(
    `${colorFilename(text.name)}:` +
      `${colorLoc(start.lineno.toString())}:` +
      `${colorLoc(start.colno.toString())} - ` +
      `${colorError('error')}: ` +
      e.message +
      '\n',
  );
  const numLen = end.lineno.toString().length;
  for (let lineno = start.lineno; lineno <= end.lineno; lineno++) {
    const line = text.lines[lineno - 1];
    const startChar = lineno > start.lineno ? 0 : start.colno - 1;
    let endChar = lineno < end.lineno ? line.length : end.colno - 1;
    endChar = Math.max(Math.min(endChar, line.length), startChar + 1);
    process.stderr.write(
      `${colorLineNumber(lineno.toString().padStart(numLen))} ${line}\n`,
    );
    process.stderr.write(
      ' '.repeat(numLen + 1 + startChar) +
        colorErrorUnderline('~'.repeat(endChar - startChar)) +
        '\n',
    );
  }
}

/**
 * Process input containing S-expression code.
 */
function processInput(name: string, source: string): boolean {
  process.stdout.write(`;; ${name}\n`);
  let exprs: SExpr[];
  try {
    exprs = parseSExpr(source);
  } catch (e) {
    if (e instanceof SourceError) {
      const text = new SourceText(name, source);
      showError(text, e);
      return false;
    }
    throw e;
  }
  for (const expr of exprs) {
    const text = printSExpr(expr);
    process.stdout.write(text + '\n');
  }
  return true;
}

async function main(): Promise<void> {
  const inputs = process.argv.slice(2);

  try {
    if (inputs.length == 0) {
      const data = await readStream(process.stdin);
      if (!processInput('<stdin>', data)) {
        process.exit(1);
      }
    } else {
      for (const input of inputs) {
        process.stdout.write(`;; ${input}\n`);
        const data = await fs.promises.readFile(input, 'utf8');
        if (!processInput(input, data)) {
          process.exit(1);
        }
      }
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
