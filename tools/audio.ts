/**
 * Audio rendering script.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

import * as yargs from 'yargs';
import { file, setGracefulCleanup } from 'tmp-promise';

import * as cli from './cli';
import { UsageError } from './cli';
import { evaluateProgram, soundParameters } from '../src/synth/evaluate';
import { disassembleProgram } from '../src/synth/opcode';
import { runProgram } from '../src/synth/engine';
import { sampleRate } from '../src/lib/audio';
import { encode } from '../src/lib/data.encode';
import {
  SourceError,
  SourceText,
  noSourceLocation,
} from '../src/lib/sourcepos';
import { waveData, floatTo16 } from './audio.wave';
import { printError } from './source';
import { parseSExpr } from '../src/lib/sexpr';
import { emitCode } from '../src/synth/node';
import { AssertionError } from '../src/debug/debug';
import { pathWithExt, projectRoot } from './util';
import { middleC, parseNoteValue, parseScore } from '../src/score/parse';
import { renderScore } from '../src/score/score';

setGracefulCleanup();

interface Note {
  /** Note value (as from parseNote). */
  value: number;
  /** Sample offset when note starts. */
  offset: number;
  /** Note gate duration, in seconds. */
  gateTime: number;
}

interface AudioArgs {
  score: boolean;
  write: boolean;
  input: string[];
  play: boolean;
  notes: Note[];
  disassemble: boolean;
  showTracks: boolean;
  verbose: boolean;
  loop: boolean;
}

/** Parse the command-line arguments. */
function parseArgs(): AudioArgs {
  const argv = yargs
    .options({
      score: {
        type: 'boolean',
        default: false,
        desc: 'Play musical score',
      },
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
      gate: {
        type: 'number',
        desc: 'Gate duration, in seconds',
      },
      disassemble: {
        alias: 'd',
        type: 'boolean',
        default: false,
        desc: 'Show program disassembly',
      },
      'show-tracks': {
        type: 'boolean',
        default: false,
        desc: 'Show info for all tracks in the score',
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
  /** Note length, in seconds. */
  const noteLength = 60 / argv.tempo;
  /** Amount of time each note is held. */
  let gateTime = noteLength;
  if (argv.gate != null) {
    gateTime = argv.gate;
  }
  if (!argv.notes.length) {
    notes = [{ value: middleC, offset: 0, gateTime }];
  } else {
    notes = [];
    let offset = 0;
    const offsetIncrement = (sampleRate * noteLength) | 0;
    for (const text of argv.notes.split(',')) {
      if (text != '') {
        let value: number;
        try {
          value = parseNoteValue({ text, sourcePos: -1 }).value;
        } catch (e) {
          if (e instanceof SourceError) {
            throw new UsageError(`invalid note: ${JSON.stringify(text)}`);
          }
          throw e;
        }
        notes.push({ value, offset, gateTime });
        offset += offsetIncrement;
      }
    }
    if (!notes.length) {
      throw new UsageError('empty list of notes');
    }
  }
  const args: AudioArgs = {
    score: argv.score,
    write: argv.write,
    input: argv._,
    play: argv.play,
    notes,
    disassemble: argv.disassemble,
    showTracks: argv['show-tracks'],
    verbose: argv.verbose,
    loop: argv.loop,
  };
  if (!args.input.length) {
    throw new UsageError('need at least one input');
  }
  if (args.loop) {
    args.play = true;
    if (args.input.length > 1) {
      throw new UsageError('cannot use multiple files with --loop');
    }
  }
  if (args.score) {
    for (const input of args.input) {
      if (!input.endsWith('.txt')) {
        throw new UsageError(
          `unknown extension for score: ${JSON.stringify(input)}`,
        );
      }
    }
  } else {
    for (const input of args.input) {
      if (!input.endsWith('.lisp')) {
        throw new UsageError(
          `unknown extension for audio: ${JSON.stringify(input)}`,
        );
      }
    }
  }
  return args;
}

let verbose!: (msg: string) => void;

/** Show the raw data for a compiled program. */
function showCode(code: Uint8Array): void {
  let out = '';

  out += '  Code:\n';
  const step = 16;
  for (let i = 0; i < code.length; i += step) {
    const row = code.subarray(i, Math.min(i + step, code.length));
    out += '   ';
    for (const x of row) {
      out += ' ';
      out += x.toString().padStart(2, ' ');
    }
    out += '\n';
  }

  out += '  Encoded:\n';
  out += '    ';
  out += encode(code);
  out += '\n';

  out += '  Size: ';
  out += code.length;
  out += '\n';

  process.stdout.write(out);
}

/** Compile an audio file. */
function compile(
  args: AudioArgs,
  inputName: string,
  inputText: string,
): Uint8Array | null {
  let code: Uint8Array;
  try {
    verbose('Parsing...');
    const exprs = parseSExpr(inputText);
    verbose('Evaluating...');
    const node = evaluateProgram(exprs, soundParameters);
    verbose('Emitting code...');
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

  return code;
}

interface Levels {
  peak: number;
  rms: number;
}

function getLevels(data: Float32Array): Levels {
  let peak = 0;
  let sumSquare = 0;
  for (let i = 0; i < data.length; i++) {
    peak = Math.max(peak, Math.abs(data[i]));
    sumSquare += data[i] ** 2;
  }
  const rms = Math.sqrt(sumSquare / data.length);
  return { peak, rms };
}

function showLevels(levels: Levels, prefix: string): void {
  function showLevel(name: string, level: number): void {
    cli.log(`${prefix}${name}: ${(20 * Math.log10(level)).toFixed(1)} dB`);
  }
  showLevel('Peak level', levels.peak);
  showLevel('RMS level', levels.rms);
}

/** Reduce the gain so a buffer doesn't clip. */
function autoGain(data: Float32Array): void {
  const levels = getLevels(data);
  showLevels(levels, '  ');
  const { peak } = levels;
  if (peak > 1) {
    const gain = 1 / peak;
    for (let i = 0; i < data.length; i++) {
      data[i] *= gain;
    }
  }
}

/** Generate WAVE file data from audio program. */
function renderSound(code: Uint8Array, notes: readonly Note[]): Buffer {
  const buffers: Float32Array[] = [];
  let outLen = 0;
  for (const note of notes) {
    const audio = runProgram(code, note.value, note.gateTime);
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
  autoGain(audio);
  return waveData({
    sampleRate,
    channelCount: 1,
    audio: floatTo16(audio),
  });
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

function exists(filename: string): Promise<boolean> {
  return fs.promises.stat(filename).then(
    (stats: fs.Stats) => stats.isFile(),
    (err: any) => {
      if (err.code == 'ENOENT') {
        return false;
      }
      throw err;
    },
  );
}

async function loadSound(
  args: AudioArgs,
  input: string,
): Promise<Uint8Array | null> {
  const source = await fs.promises.readFile(input, 'utf8');
  return compile(args, input, source);
}

async function runMain(
  args: AudioArgs,
  input: string,
  writer: Writer | null,
): Promise<boolean> {
  const source = await fs.promises.readFile(input, 'utf8');
  if (!args.score) {
    const code = compile(args, input, source);
    if (code == null) {
      return false;
    }
    showCode(code);
    if (writer != null) {
      const data = renderSound(code, args.notes);
      await writer.write(data);
      if (args.play) {
        await playAudio(writer.path);
      }
    }
  } else {
    const soundPaths: string[] = [];
    let code: Uint8Array;
    interface Track {
      name: string;
      code: Uint8Array;
    }
    let tracks: Track[] = [];
    try {
      const score = parseScore(source);
      const { sounds } = score;
      const soundMap = new Map<string, number>();
      for (let i = 0; i < sounds.length; i++) {
        const { name, locs } = sounds[i];
        const loc = locs[0] || noSourceLocation;
        if (!/^[a-zA-Z0-9][-_.a-zA-Z0-9]*$/.test(name)) {
          throw new SourceError(
            loc,
            `invalid sound name: ${JSON.stringify(name)}`,
          );
        }
        const filename = path.join(projectRoot, 'audio', name + '.lisp');
        if (!(await exists(filename))) {
          throw new SourceError(
            loc,
            `sound does not exist: ${JSON.stringify(name)}`,
          );
        }
        soundMap.set(name, i);
        soundPaths.push(filename);
      }
      code = score.emit(soundMap);
      if (args.showTracks) {
        cli.log('Track Sizes:');
        for (const name of score.tracks) {
          const code = score.emit(soundMap, [name]);
          tracks.push({ name, code });
          cli.log(`  ${JSON.stringify(name)}: ${code.length} bytes`);
        }
      }
    } catch (e) {
      if (e instanceof SourceError) {
        const text = new SourceText(input, source);
        printError(text, e);
        return false;
      }
      throw e;
    }
    showCode(code);
    if (writer != null || args.showTracks) {
      const maybeSounds = await Promise.all(
        soundPaths.map(input => loadSound(args, input)),
      );
      const sounds: Uint8Array[] = [];
      // This code is longer than .some(x => x != null) but doesn't have casts.
      for (let i = 0; i < maybeSounds.length; i++) {
        const sound = maybeSounds[i];
        if (sound == null) {
          return false;
        }
        sounds.push(sound);
      }
      if (args.showTracks) {
        for (const { name, code } of tracks) {
          cli.log('Track Audio:');
          cli.log(`  ${JSON.stringify(name)}:`);
          const [audio, length] = renderScore(code, sounds);
          cli.log(`    Length: ${length.toFixed(1)}s`);
          const levels = getLevels(audio);
          showLevels(levels, '    ');
        }
      }
      if (writer != null) {
        const [audio, length] = renderScore(code, sounds);
        cli.log(`  Length: ${length.toFixed(1)}s`);
        autoGain(audio);
        const data = waveData({
          sampleRate,
          channelCount: 1,
          audio: floatTo16(audio),
        });
        await writer.write(data);
        if (args.play) {
          await playAudio(writer.path);
        }
      }
    }
  }
  return true;
}

function delay(timeMS: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeMS));
}

async function loopMain(
  args: AudioArgs,
  input: string,
  writer: Writer | null,
): Promise<void> {
  let lastMtime = 0;
  let lastSuccess = true;
  while (true) {
    let st: fs.Stats;
    try {
      st = await fs.promises.stat(input);
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
    lastSuccess = await runMain(args, input, writer);
  }
}

/** Return the output WAVE filename for the given input filename. */
function outputName(input: string): string {
  return pathWithExt(input, '.wav');
}

async function main(): Promise<void> {
  let args: AudioArgs;
  try {
    args = parseArgs();
  } catch (e) {
    if (e instanceof UsageError) {
      cli.error(e.message);
      process.exit(2);
      return;
    }
    cli.exception(e);
    process.exit(1);
    return;
  }
  verbose = args.verbose ? cli.log : () => {};
  let status = 0;

  try {
    if (args.loop) {
      if (args.input.length != 1) {
        throw new AssertionError('bad args: input.length != 1');
      }
      const [input] = args.input;
      let writer: Writer;
      if (args.write) {
        writer = makeFileWriter(outputName(input));
      } else {
        writer = await makeTempWriter();
      }
      await loopMain(args, input, writer);
    } else {
      let writer: Writer | null = null;
      if (args.play && !args.write) {
        writer = await makeTempWriter();
      }
      for (const input of args.input) {
        let iwriter = args.write ? makeFileWriter(outputName(input)) : writer;
        process.stdout.write(`\nSound: ${input}\n`);
        const success = await runMain(args, input, iwriter);
        if (!success) {
          status = 1;
        }
      }
    }
  } catch (e) {
    cli.exception(e);
    status = 1;
  }

  process.exit(status);
}

main();
