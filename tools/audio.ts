/**
 * Audio rendering script.
 */

import * as fs from 'fs';

import * as program from 'commander';

import { sampleRate, generateAudio } from '../src/audio.synth';
import { waveData, floatTo16 } from './audio.wave';

interface AudioArgs {
  output: string;
}

function parseArgs() {
  program.option('--output <file>', 'path to output WAVE file');
  program.parse(process.argv);
  const args: AudioArgs = {
    output: '',
  };
  for (const arg of Object.keys(args)) {
    if (arg in program) {
      args[arg as keyof AudioArgs] = program[arg];
    }
  }
  if (args.output == '') {
    console.error('--output is required');
    process.exit(2);
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const { output } = args;

  try {
    const audio = generateAudio();
    const data = waveData({
      sampleRate,
      channelCount: 1,
      audio: floatTo16(audio),
    });
    await fs.promises.writeFile(output, data);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
