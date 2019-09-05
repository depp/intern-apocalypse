/**
 * Audio rendering script.
 */

import * as fs from 'fs';
import * as child_process from 'child_process';

import * as program from 'commander';
import { file, setGracefulCleanup } from 'tmp-promise';

import { evaluateProgram } from '../src/synth/evaluate';
import { disassembleProgram } from '../src/synth/opcode';
import { sampleRate, runProgram } from '../src/synth/engine';
import { encode } from '../src/lib/data.encode';
import { SourceError, SourceText } from '../src/lib/sourcepos';
import { waveData, floatTo16 } from './audio.wave';
import { readStream } from './stream';
import { printError } from './source';
import { parseSExpr } from '../src/lib/sexpr';
import { emitCode } from '../src/synth/node';

setGracefulCleanup();

interface AudioArgs {
  output: string;
  input: string;
  play: boolean;
  disassemble: boolean;
  verbose: boolean;
  loop: boolean;
}

function parseArgs() {
  program.option('--output <file>', 'path to output WAVE file');
  program.option('--play', 'play the audio file');
  program.option('--disassemble', 'show program disassembly');
  program.option('--loop', 'play repeatedly as file changes');
  program.option('-v --verbose', 'verbose logging');
  program.parse(process.argv);
  const args: AudioArgs = {
    output: '',
    input: '-',
    play: false,
    disassemble: false,
    verbose: false,
    loop: false,
  };
  for (const arg of Object.keys(args)) {
    if (arg != 'input' && arg in program) {
      // @ts-ignore: This is a hack.
      args[arg] = program[arg];
    }
  }
  if (program.args.length) {
    if (program.args.length > 1) {
      console.error(`unexpected argument ${program.args[1]}`);
      program.exit(2);
    }
    args.input = program.args[0];
  }
  if (args.loop) {
    args.play = true;
    if (args.input == '-') {
      console.error('cannot read from stdin with --loop');
      program.exit(2);
    }
  }
  return args;
}

let verbose = false;

function log(msg: string) {
  if (verbose) {
    console.log(msg);
  }
}

/** Compile an audio file. */
function compile(
  args: AudioArgs,
  inputName: string,
  inputText: string,
): Uint8Array | null {
  let code: Uint8Array;
  try {
    log('Parsing...');
    const exprs = parseSExpr(inputText);
    log('Evaluating...');
    const node = evaluateProgram(exprs);
    log('Emitting code...');
    code = emitCode(node);
  } catch (e) {
    if (e instanceof SourceError) {
      const text = new SourceText(inputName, inputText);
      printError(text, e);
      return null;
    }
    throw e;
  }

  if (args.disassemble) {
    process.stdout.write('Assembly:\n');
    const disassembly = disassembleProgram(code);
    for (const line of disassembly) {
      process.stdout.write('  ' + line + '\n');
    }
    process.stdout.write('\n');
  }

  process.stdout.write('Code:\n');
  for (let i = 0; i < code.length; i += 16) {
    process.stdout.write(
      '  ' +
        Array.from(code.slice(i, i + 16))
          .map(x => x.toString().padStart(2, ' '))
          .join(' ') +
        '\n',
    );
  }

  process.stdout.write('\n');

  process.stdout.write('Encoded:\n');
  process.stdout.write('  ' + encode(code) + '\n');
  process.stdout.write('\n');

  return code;
}

/** Generate WAVE file data from audio program. */
function makeWave(code: Uint8Array): Buffer {
  const audio = runProgram(code);
  return waveData({
    sampleRate,
    channelCount: 1,
    audio: floatTo16(audio),
  });
}

interface Reader {
  path: string;
  read(): Promise<string>;
}

function makeReader(args: AudioArgs): Reader {
  if (args.input == '-') {
    return {
      path: '<stdin>',
      read() {
        return readStream(process.stdin);
      },
    };
  }
  return {
    path: args.input,
    read() {
      return fs.promises.readFile(args.input, 'utf8');
    },
  };
}

interface Writer {
  path: string;
  write(data: Buffer): Promise<void>;
}

async function makeWriter(args: AudioArgs): Promise<Writer> {
  if (args.output != '') {
    return {
      path: args.output,
      async write(data) {
        await fs.promises.writeFile(args.output, data);
      },
    };
  }
  let r = await file({ postfix: '.wav' });
  return {
    path: r.path,
    async write(data) {
      const { fd } = r;
      await new Promise((resolve, reject) =>
        fs.ftruncate(fd, 0, err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }),
      );
      await new Promise((resolve, reject) =>
        fs.write(fd, data, 0, data.length, 0, err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }),
      );
    },
  };
}

function playAudio(path: string): Promise<void> {
  let prog: string;
  switch (process.platform) {
    case 'darwin':
      prog = 'afplay';
      break;
    case 'linux':
      prog = 'aplay';
      break;
    default:
      throw new Error(
        `cannot play audio on platform ${JSON.stringify(process.platform)}`,
      );
  }
  return new Promise((resolve, reject) => {
    child_process.execFile(prog, [path], (err, stdout, stderr) => {
      process.stderr.write(stdout);
      process.stderr.write(stderr);
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function runMain(
  args: AudioArgs,
  reader: Reader,
  writer: Writer | null,
): Promise<boolean> {
  const source = await reader.read();
  const code = compile(args, reader.path, source);
  if (code == null) {
    return false;
  }
  if (writer != null) {
    const data = makeWave(code);
    await writer.write(data);
    if (args.play) {
      await playAudio(writer.path);
    }
  }
  return true;
}

function delay(timeMS: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeMS));
}

async function loopMain(
  args: AudioArgs,
  reader: Reader,
  writer: Writer | null,
): Promise<void> {
  let lastMtime = 0;
  let lastSuccess = true;
  while (true) {
    let st: fs.Stats;
    try {
      st = await fs.promises.stat(reader.path);
    } catch (e) {
      if (e.code == 'ENOENT') {
        await delay(500);
        continue;
      }
      throw e;
    }
    if (!lastSuccess && st.mtimeMs == lastMtime) {
      await delay(500);
      continue;
    }
    lastMtime = st.mtimeMs;
    lastSuccess = await runMain(args, reader, writer);
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  verbose = args.verbose;
  let status = 0;

  try {
    const reader = makeReader(args);
    const writer = await makeWriter(args);
    if (args.loop) {
      await loopMain(args, reader, writer);
    } else {
      const success = await runMain(args, reader, writer);
      if (!success) {
        status = 1;
      }
    }
  } catch (e) {
    console.error(e);
    status = 1;
  }

  process.exit(status);
}

main();
