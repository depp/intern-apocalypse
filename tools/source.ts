/**
 * Utilities for working with source code.
 */

import chalk from 'chalk';

import { SourceSpan, SourceText } from '../src/lib/sourcepos';

const colorFilename: (s: string) => string = chalk.cyan;
const colorLoc: (s: string) => string = chalk.yellow;
const colorError: (s: string) => string = chalk.red;
const colorErrorUnderline: (s: string) => string = chalk.red;
const colorLineNumber: (s: string) => string = chalk.inverse;

/**
 * Print an error message to stderr.
 */
export function printError(text: SourceText, e: Error & SourceSpan): void {
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
