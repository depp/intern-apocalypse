/**
 * Audio rendering script.
 */

import * as fs from 'fs';
import * as child_process from 'child_process';

import * as program from 'commander';
import { file } from 'tmp-promise';

import { evaluateProgram } from '../src/synth/evaluate';
import { disassembleProgram } from '../src/synth/opcode';
import { sampleRate, runProgram } from '../src/synth/engine';
import { encode } from '../src/data.encode';
import { SourceError, SourceText } from '../src/sourcepos';
import { waveData, floatTo16 } from './audio.wave';
import { readStream } from './stream';
import { printError } from './source';
import { parseSExpr } from '../src/sexpr';
import { emitCode } from '../src/synth/node';

interface AudioArgs {
  output: string;
  input: string;
  play: false;
  disassemble: boolean;
  verbose: false;
}

function parseArgs() {
  program.option('--output <file>', 'path to output WAVE file');
  program.option('--play', 'play the audio file');
  program.option('--disassemble', 'show program disassembly');
  program.option('-v --verbose', 'verbose logging');
  program.parse(process.argv);
  const args: AudioArgs = {
    output: '',
    input: '-',
    play: false,
    disassemble: false,
    verbose: false,
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
  return args;
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
      process.stderr.write(stderr);
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs();
  const cleanup: (() => Promise<void>)[] = [];
  let status = 0;

  try {
    let inputName: string;
    let inputText: string;
    if (args.input == '-') {
      inputName = '<stdin>';
      inputText = await readStream(process.stdin);
    } else {
      inputName = args.input;
      inputText = await fs.promises.readFile(inputName, 'utf8');
    }

    let code: Uint8Array;
    try {
      if (args.verbose) {
        console.log('Parsing...');
      }
      const exprs = parseSExpr(inputText);
      if (args.verbose) {
        console.log('Evaluating...');
      }
      const node = evaluateProgram(exprs);
      if (args.verbose) {
        console.log('Emitting code...');
      }
      code = emitCode(node);
    } catch (e) {
      if (e instanceof SourceError) {
        const text = new SourceText(inputName, inputText);
        printError(text, e);
        process.exit(1);
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

    let wavpath: string | undefined;
    if (args.output != '' || args.play) {
      if (args.verbose) {
        console.log('Running...');
      }
      const audio = runProgram(code);
      const data = waveData({
        sampleRate,
        channelCount: 1,
        audio: floatTo16(audio),
      });
      if (args.output != '') {
        await fs.promises.writeFile(args.output, data);
        wavpath = args.output;
      } else {
        const r = await file({ postfix: '.wav' });
        cleanup.push(r.cleanup);
        wavpath = r.path;
        await new Promise((resolve, reject) =>
          fs.write(r.fd, data, err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }),
        );
      }
    }

    if (args.play) {
      if (wavpath == null) {
        throw new Error('null wavpath');
      }
      await playAudio(wavpath);
    }
  } catch (e) {
    console.error(e);
    status = 1;
  }
  for (const func of cleanup) {
    await func();
  }

  process.exit(status);
}

main();
