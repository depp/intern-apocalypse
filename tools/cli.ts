import chalk from 'chalk';
import { AssertionError } from '../src/debug/debug';

const colorError: (s: string) => string = chalk.red;
const colorWarning: (s: string) => string = chalk.yellow;

/** Error type for invalid CLI usage. */
export class UsageError extends Error {}

function logMessage(level: string, msg: string): void {
  let out = '';
  out += level;
  out += ': ';
  out += msg;
  out += '\n';
  process.stderr.write(out);
}

/** Log a simple message to the console. */
export function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

/** Print an error to the console. */
export function error(msg: string): void {
  logMessage(colorError('error'), msg);
}

/** Print a warning to the console. */
export function warn(msg: string): void {
  logMessage(colorWarning('warning'), msg);
}

/** Print an exception to the console. */
export function exception(e: any): void {
  error(e.message);
  if (e instanceof AssertionError) {
    const obj = e.object;
    if (typeof obj == 'object' && obj != null) {
      let out = '';
      for (const key in Object.keys(obj)) {
        out += '  ';
        out += key;
        out += ': ';
        out += JSON.stringify(obj[key]);
        out += '\n';
      }
      process.stderr.write(out);
    }
  }
  if ('stack' in e) {
    console.log(e.stack);
  }
}

if (require.main == module) {
  function main() {
    error('an error message');
    warn('a warning message');
    try {
      throw new Error('example error');
    } catch (e) {
      exception(e);
    }
  }

  main();
}
