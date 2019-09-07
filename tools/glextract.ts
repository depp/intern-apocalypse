/**
 * Extract GL API constants from header file.
 */

import * as fs from 'fs';
import * as path from 'path';

import * as program from 'commander';

interface GLExtractArgs {
  input: string;
  output: string;
}

function parseArgs(): GLExtractArgs {
  program.option('--output <file>', 'path to output JSON file');
  program.parse(process.argv);
  const args: GLExtractArgs = {
    input: '',
    output: program.output || '',
  };
  if (program.args.length == 0) {
    console.error('required GL header file argument');
    program.exit(2);
  }
  if (program.args.length > 1) {
    console.error(`unexpected argument ${program.args[1]}`);
    program.exit(2);
  }
  args.input = program.args[0];
  return args;
}

function parseConstants(source: string): Map<string, number> {
  const matchDef = /^#define\s+GL_([_A-Za-z0-9]+)\s+(\S+)\s*$/gm;
  const constants = new Map<string, number>();
  let match: RegExpMatchArray | null;
  while ((match = matchDef.exec(source)) != null) {
    const [, name, definition] = match;
    let value: number;
    if (/^0x[a-f0-9]+$/i.test(definition)) {
      value = parseInt(definition.substring(2), 16);
    } else if (/^[1-9][0-9]*$/.test(definition)) {
      value = parseInt(definition, 10);
    } else if (/^0[0-7]*$/.test(definition)) {
      value = parseInt(definition, 8);
    } else {
      continue;
    }
    constants.set(name, value);
  }
  return constants;
}

async function main(): Promise<void> {
  const args = parseArgs();

  try {
    const source = await fs.promises.readFile(args.input, 'utf8');
    const constants = parseConstants(source);
    const obj: { [s: string]: number } = {};
    for (const [key, value] of constants.entries()) {
      obj[key] = value;
    }
    const data = JSON.stringify(obj, null, '  ') + '\n';
    if (args.output == '') {
      process.stdout.write(data);
    } else {
      await fs.promises.writeFile(args.output, data, 'utf8');
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
