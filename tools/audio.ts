/**
 * Audio rendering script.
 */

import * as fs from 'fs';
import * as child_process from 'child_process';

import * as yargs from 'yargs';
import { file, setGracefulCleanup } from 'tmp-promise';

import { evaluateProgram, soundParameters } from '../src/synth/evaluate';
import { disassembleProgram } from '../src/synth/opcode';
import { sampleRate, runProgram } from '../src/synth/engine';
import { encode } from '../src/lib/data.encode';
import { SourceError, SourceText } from '../src/lib/sourcepos';
import { waveData, floatTo16 } from './audio.wave';
import { printError } from './source';
import { parseSExpr } from '../src/lib/sexpr';
import { emitCode } from '../src/synth/node';
import { AssertionError } from '../src/debug/debug';
import { pathWithExt } from './util';
import { middleC, parseNote } from '../src/score/note';

setGracefulCleanup();

interface Note {
  /** Note value (as from parseNote). */
  value: number;
  /** Sample offset when note starts. */
  offset: number;
}

interface AudioArgs {
  write: boolean;
  input: string[];
  play: boolean;
  notes: Note[];
  disassemble: boolean;
  verbose: boolean;
  loop: boolean;
}

/** Parse the command-line arguments. */
function parseArgs(): AudioArgs {
  const argv = yargs
    .options({
      write: {
        alias: 'w',
        type: 'boolean',
        default: false,
        desc: 'Write output WAVE files',
      },
      play: {
        alias: 'p',
        type: 'boolean',
        default: false,
        desc: 'Play sounds',
      },
      notes: {
        type: 'string',
        default: '',
        desc: 'Note values to play, separated by commas',
      },
      tempo: {
        type: 'number',
        default: 120,
        desc: 'Tempo to play notes at (quarter notes)',
      },
      disassemble: {
        alias: 'd',
        type: 'boolean',
        default: false,
        desc: 'Show program disassembly',
      },
      loop: {
        alias: 'l',
        type: 'boolean',
        default: false,
        desc: 'Play a single sound repeatedly as input changes',
      },
      verbose: {
        alias: 'v',
        type: 'boolean',
        default: false,
        desc: 'Verbose logging',
      },
    })
    .command('$0', 'Compile audio scripts', yargs =>
      yargs.positional('input', { desc: 'Input audio script' }),
    )
    .help()
    .version(false)
    .strict().argv;
  let notes: Note[];
  if (!argv.notes.length) {
    notes = [{ value: middleC, offset: 0 }];
  } else {
    notes = [];
    let offset = 0;
    const offsetIncrement = ((sampleRate * 60) / argv.tempo) | 0;
    for (const text of argv.notes.split(',')) {
      if (text != '') {
        const value = parseNote(text);
        if (!value) {
          console.error(`invalid note: ${JSON.stringify(text)}`);
          process.exit(2);
          throw new AssertionError('unreachable');
        }
        notes.push({ value, offset });
        offset += offsetIncrement;
      }
    }
    if (!notes.length) {
      console.error('empty list of notes');
      process.exit(2);
    }
  }
  const args: AudioArgs = {
    write: argv.write,
    input: argv._,
    play: argv.play,
    notes,
    disassemble: argv.disassemble,
    verbose: argv.disassemble,
    loop: argv.loop,
  };
  if (!args.input.length) {
    console.error('need at least one input');
    process.exit(2);
  }
  if (args.loop) {
    args.play = true;
    if (args.input.length > 1) {
      console.error('cannot use multiple files with --loop');
      process.exit(2);
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
    const node = evaluateProgram(exprs, soundParameters);
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
    process.stdout.write('\n');
    process.stdout.write('  Assembly:\n');
    const disassembly = disassembleProgram(code);
    for (const line of disassembly) {
      process.stdout.write('    ' + line + '\n');
    }
  }

  process.stdout.write('\n');
  process.stdout.write('  Code:\n');
  for (let i = 0; i < code.length; i += 16) {
    process.stdout.write(
      '    ' +
        Array.from(code.slice(i, i + 16))
          .map(x => x.toString().padStart(2, ' '))
          .join(' ') +
        '\n',
    );
  }

  process.stdout.write('\n');
  process.stdout.write('  Encoded:\n');
  process.stdout.write('    ' + encode(code) + '\n');

  return code;
}

/** Generate WAVE file data from audio program. */
function makeWave(code: Uint8Array, notes: readonly Note[]): Buffer {
  const buffers: Float32Array[] = [];
  let outLen = 0;
  for (const note of notes) {
    const audio = runProgram(code, note.value);
    buffers.push(audio);
    outLen = Math.max(outLen, note.offset + audio.length);
  }
  let audio: Float32Array;
  if (buffers.length == 1) {
    audio = buffers[0];
  } else {
    audio = new Float32Array(outLen);
    for (let i = 0; i < notes.length; i++) {
      const { offset } = notes[i];
      const buffer = buffers[i];
      for (let j = 0; j < buffer.length; j++) {
        audio[offset + j] += buffer[j];
      }
    }
  }
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

function fileReader(input: string): Reader {
  return {
    path: input,
    read() {
      return fs.promises.readFile(input, 'utf8');
    },
  };
}

interface Writer {
  path: string;
  write(data: Buffer): Promise<void>;
}

function makeFileWriter(output: string): Writer {
  return {
    path: output,
    async write(data) {
      await fs.promises.writeFile(output, data);
    },
  };
}

async function makeTempWriter(): Promise<Writer> {
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
    const data = makeWave(code, args.notes);
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

/** Return the output WAVE filename for the given input filename. */
function outputName(input: string): string {
  return pathWithExt(input, '.wav');
}

async function main(): Promise<void> {
  const args = parseArgs();
  verbose = args.verbose;
  let status = 0;

  try {
    if (args.loop) {
      if (args.input.length != 1) {
        throw new AssertionError('bad args: input.length != 1');
      }
      const [input] = args.input;
      const reader = fileReader(input);
      let writer: Writer;
      if (args.write) {
        writer = makeFileWriter(outputName(input));
      } else {
        writer = await makeTempWriter();
      }
      await loopMain(args, reader, writer);
    } else {
      let writer: Writer | null = null;
      if (args.play && !args.write) {
        writer = await makeTempWriter();
      }
      for (const input of args.input) {
        const reader = fileReader(input);
        let iwriter = args.write ? makeFileWriter(outputName(input)) : writer;
        process.stdout.write(`\nSound: ${input}\n`);
        const success = await runMain(args, reader, iwriter);
        if (!success) {
          status = 1;
        }
      }
    }
  } catch (e) {
    console.error(e);
    status = 1;
  }

  process.exit(status);
}

main();
