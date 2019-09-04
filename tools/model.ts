import * as fs from 'fs';

import * as program from 'commander';

import { convertModel } from '../src/model/convert';
import { SourceError, SourceText } from '../src/lib/sourcepos';
import { printError } from './source';
import { encode } from '../src/lib/data.encode';

/** Program arguments. */
interface ModelArgs {
  inputs: string[];
}

/** Parse program arguments. */
function parseArgs(): ModelArgs {
  program.allowUnknownOption(false);
  program.parse(process.argv);
  const args: ModelArgs = {
    inputs: [],
  };
  if (program.args.length < 1) {
    console.error(`expected 1 or more arguments`);
    process.exit(2);
  }
  args.inputs = program.args;
  return args;
}

/** Process a single model. */
async function processModel(filename: string): Promise<boolean> {
  const source = await fs.promises.readFile(filename, 'utf8');
  let data: Uint8Array;
  try {
    data = convertModel(source);
  } catch (e) {
    if (e instanceof SourceError) {
      const text = new SourceText(filename, source);
      printError(text, e);
      return false;
    }
    throw e;
  }
  let text = '';
  text += '\n';
  text += `Model: ${filename}\n`;
  text += `    Size: ${data.length} bytes\n`;
  text += `    Data: ${encode(data)}\n`;
  process.stdout.write(text);
  return true;
}

/** Main program, called from entry point. */
async function runMain(args: ModelArgs): Promise<boolean> {
  let status = true;
  for (const input of args.inputs) {
    if (!(await processModel(input))) {
      status = false;
    }
  }
  return status;
}

/** Program entry point. */
async function main(): Promise<void> {
  const args = parseArgs();
  let status = false;
  try {
    status = await runMain(args);
  } catch (e) {
    console.error(e);
  }
  if (!status) {
    process.exit(1);
  }
}

main();
