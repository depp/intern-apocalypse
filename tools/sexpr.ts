/**
 * S-expression testing script.
 *
 * When run, checks Lisp code for syntax errors and prints the code back out.
 */

import * as fs from 'fs';

import { readStream } from './stream';

import { SExpr, parseSExpr, printSExpr } from '../src/lib/sexpr';
import { SourceText, SourceError } from '../src/lib/sourcepos';
import { printError } from './source';

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
      printError(text, e);
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
