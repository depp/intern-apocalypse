/**
 * Extract GL API constants from header file.
 */

import * as fs from 'fs';

import * as yargs from 'yargs';

interface GLExtractArgs {
  input: string;
  output: string | null;
}

function parseArgs(): GLExtractArgs {
  const argv = yargs
    .options({
      output: { alias: 'o', type: 'string', desc: 'Output JSON file' },
    })
    .help()
    .version(false)
    .strict().argv;
  if (argv._.length == 0) {
    console.error('required GL header file argument');
    process.exit(2);
  }
  if (argv._.length > 1) {
    console.error(`unexpected argument ${argv._[1]}`);
    process.exit(2);
  }
  return {
    input: argv._[0],
    output: argv.output || null,
  };
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
    if (args.output == null) {
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
