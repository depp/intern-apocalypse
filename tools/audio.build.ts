/**
 * Embed audio data in game.
 */

import * as fs from 'fs';
import * as path from 'path';

import { BuildContext, BuildAction } from './action';
import { Config, BuildArgs } from './config';
import {
  convertName,
  generatedHeader,
  listFilesWithExtensions,
  prettifyTypeScript,
} from './util';
import { SourceError, SourceText } from '../src/lib/sourcepos';
import { printError } from './source';
import { encode } from '../src/lib/data.encode';
import { AssertionError } from '../src/debug/debug';
import { parseSExpr } from '../src/lib/sexpr';
import { evaluateProgram } from '../src/synth/evaluate';
import { emitCode } from '../src/synth/node';

const defsFile = 'src/audio/sounds.ts';
const dataFile = 'build/sounds.js';

interface SoundInfo {
  name: string;
  filename: string;
}

/** List all sounds in the game. */
function listSounds(params: PackAudioParameters): SoundInfo[] | null {
  const filenames = new Map<string, string>();
  for (const input of params.inputs) {
    let soundname = path.basename(input);
    const dot = soundname.indexOf('.');
    if (dot != -1) {
      soundname = soundname.substring(0, dot);
    }
    const name = convertName(soundname).upperCase;
    if (filenames.has(name)) {
      console.error(`Multiple sounds have name ${JSON.stringify(name)}`);
      return null;
    }
    filenames.set(name, input);
  }
  const names = Array.from(filenames.keys());
  names.sort();
  const result: SoundInfo[] = [];
  for (const name of names) {
    const filename = filenames.get(name);
    if (filename == null) {
      throw new AssertionError(`filename == null`);
    }
    result.push({ name, filename });
  }
  return result;
}

/** Generate the sound definition enum from the sound list. */
function generateDefs(sounds: SoundInfo[]): string {
  let out = '';
  out += generatedHeader;
  out += '\n';
  out += '/** Sound asset identifiers. */\n';
  out += 'export const enum Sounds {\n';
  for (const { name } of sounds) {
    out += `  ${name},\n`;
  }
  out += '}\n';
  out += '\n';
  out += '/** Loaded sounds. */\n';
  out += 'export const sounds: (Uint8Array | null)[] = [];\n';
  out += '\n';
  out += '/** Get list of sound filenames, in order. */\n';
  out += 'export function getSoundNames(): string[] {\n';
  out += `  return ${JSON.stringify(sounds.map(m => m.filename))};\n`;
  out += '}\n';
  return out;
}

/** Process a sound, returning the data as a string if successful. */
async function processSound(filename: string): Promise<string | null> {
  const source = await fs.promises.readFile(filename, 'utf8');
  let data: Uint8Array;
  try {
    const exprs = parseSExpr(source);
    const node = evaluateProgram(exprs);
    data = emitCode(node);
  } catch (e) {
    if (e instanceof SourceError) {
      const text = new SourceText(filename, source);
      printError(text, e);
      return null;
    }
    throw e;
  }
  return encode(data);
}

/** Process all sounds, returning the source of the sound data file. */
async function generateData(sounds: SoundInfo[]): Promise<string | null> {
  const soundsData: Promise<string | null>[] = [];
  for (const { filename } of sounds) {
    soundsData.push(processSound(filename));
  }
  let data = '';
  for (const promise of soundsData) {
    const item = await promise;
    if (item == null) {
      return null;
    }
    data += ' ';
    data += item;
  }
  let out = '';
  out += generatedHeader;
  out += "import { decode } from '../lib/data.encode';\n";
  out += 'const data = ';
  out += JSON.stringify(data.substring(1));
  out += ';\n';
  out += "export let sounds = data.split(' ').map(decode);\n";
  return out;
}

/** Generate the audio definitions file. */
async function generateSources(
  config: Config,
  params: PackAudioParameters,
): Promise<boolean> {
  const sounds = listSounds(params);
  if (sounds == null) {
    return false;
  }
  let outData: Promise<boolean> | null = null;
  if (config == Config.Release) {
    outData = (async () => {
      const text = await generateData(sounds);
      if (text == null) {
        return false;
      }
      await fs.promises.writeFile(dataFile, text, 'utf8');
      return true;
    })();
  }
  const defs = prettifyTypeScript(generateDefs(sounds));
  await fs.promises.writeFile(defsFile, defs, 'utf8');
  if (outData) {
    return await outData;
  }
  return true;
}

/**
 * Build step which packs the audio programs into JavaScript code and emits
 * stubs for TypeScript.
 */
class PackAudio implements BuildAction {
  private readonly params: PackAudioParameters;
  private readonly config: Config;
  constructor(config: Config, params: PackAudioParameters) {
    this.config = config;
    this.params = params;
  }
  get name(): string {
    return 'PackAudio';
  }
  get inputs(): readonly string[] {
    return this.params.inputs;
  }
  get outputs(): readonly string[] {
    const outputs = [defsFile];
    if (this.config == Config.Release) {
      outputs.push(dataFile);
    }
    return outputs;
  }

  /** Pack the audio programs and emit loading stubs. */
  async execute(config: BuildArgs): Promise<boolean> {
    await generateSources(config.config, this.params);
    return true;
  }
}

/** Parameters for the PackAudio build step. */
export interface PackAudioParameters {
  /** A list of all input audio programs. */
  inputs: readonly string[];
}

/** Emit build actions to pack audio. */
export function packAudio(
  ctx: BuildContext,
  params: PackAudioParameters,
): void {
  ctx.addAction(new PackAudio(ctx.config.config, params));
}

async function main(): Promise<void> {
  let status = false;
  try {
    const inputs = listFilesWithExtensions('audio', ['.lisp']);
    status = await generateSources(Config.Debug, { inputs });
  } catch (e) {
    console.error(e);
  }
  if (!status) {
    process.exit(1);
  }
}

if (require.main == module) {
  main();
}
