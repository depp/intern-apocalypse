/**
 * Audio rendering script.
 */

import * as fs from 'fs';

import * as program from 'commander';

import { compileProgram } from '../src/audio.synth.compile';
import { disassembleProgram } from '../src/audio.synth.opcode';
import { sampleRate, runProgram } from '../src/audio.synth';
import { SourceError, SourceText } from '../src/sourcepos';
import { waveData, floatTo16 } from './audio.wave';
import { readStream } from './stream';
import { printError } from './source';

interface AudioArgs {
  output: string;
  input: string;
  disassemble: boolean;
}

function parseArgs() {
  program.option('--output <file>', 'path to output WAVE file');
  program.option('--disassemble', 'show program disassembly');
  program.parse(process.argv);
  const args: AudioArgs = {
    output: '',
    input: '-',
    disassemble: false,
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

async function main(): Promise<void> {
  const args = parseArgs();

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
      code = compileProgram(inputText);
    } catch (e) {
      if (e instanceof SourceError) {
        const text = new SourceText(inputName, inputText);
        printError(text, e);
        process.exit(1);
      }
      throw e;
    }
    if (args.disassemble) {
      const disassembly = disassembleProgram(code);
      for (const line of disassembly) {
        process.stdout.write(line + '\n');
      }
    }
    if (args.output != '') {
      const audio = runProgram(code);
      const data = waveData({
        sampleRate,
        channelCount: 1,
        audio: floatTo16(audio),
      });
      await fs.promises.writeFile(args.output, data);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
