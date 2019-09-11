/**
 * Embed audio data in game.
 */

import * as fs from 'fs';
import * as path from 'path';

import { BuildContext, BuildAction, BuildError } from './action';
import { Config, BuildArgs } from './config';
import {
  convertName,
  generatedHeader,
  listFilesWithExtensions,
  prettifyTypeScript,
} from './util';
import {
  SourceError,
  SourceText,
  noSourceLocation,
} from '../src/lib/sourcepos';
import { printError } from './source';
import { encode } from '../src/lib/data.encode';
import { AssertionError } from '../src/debug/debug';
import { parseSExpr } from '../src/lib/sexpr';
import { evaluateProgram, soundParameters } from '../src/synth/evaluate';
import { emitCode } from '../src/synth/node';
import { parseScore } from '../src/score/parse';

const defsFile = 'src/audio/sounds.ts';
export const soundsDataPath = 'build/sounds.json';

interface SoundInfo {
  name: string;
  filename: string;
}

/** List all sounds in the game. */
function listSounds(inputs: readonly string[]): SoundInfo[] {
  const filenames = new Map<string, string>();
  for (const input of inputs) {
    let soundname = path.basename(input);
    const dot = soundname.indexOf('.');
    if (dot != -1) {
      soundname = soundname.substring(0, dot);
    }
    const name = convertName(soundname).upperCase;
    if (filenames.has(name)) {
      throw new BuildError(`Multiple sounds have name ${JSON.stringify(name)}`);
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
function generateDefs(sounds: SoundInfo[], music: SoundInfo[]): string {
  let out = '';
  out += generatedHeader;
  interface Data {
    items: SoundInfo[];
    doc1: string;
    name1: string;
    doc2: string;
    name2: string;
  }
  const data: Data[] = [
    {
      items: sounds,
      doc1: 'Sound asset identifiers.',
      name1: 'Sounds',
      doc2: 'Get list of sound filenames, in order.',
      name2: 'getSoundNames',
    },
    {
      items: music,
      doc1: 'Music track asset identifiers.',
      name1: 'MusicTracks',
      doc2: 'Get list of music score filenames, in order.',
      name2: 'getMusicNames',
    },
  ];
  for (const { items, doc1, name1, doc2, name2 } of data) {
    out += '\n';
    out += `/** ${doc1} */\n`;
    out += `export const enum ${name1} {\n`;
    for (const { name } of items) {
      out += `  ${name},\n`;
    }
    out += '}\n';

    out += '\n';
    out += `/** ${doc2} */\n`;
    out += `export function ${name2}(): string[] {\n`;
    out += `  return ${JSON.stringify(items.map(m => m.filename))};\n`;
    out += '}\n';
  }
  return out;
}

/** Process a sound, returning the data as a string if successful. */
async function processSound(filename: string): Promise<string | null> {
  const source = await fs.promises.readFile(filename, 'utf8');
  let data: Uint8Array;
  try {
    const exprs = parseSExpr(source);
    const node = evaluateProgram(exprs, soundParameters);
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

/** Process all sounds, returning the encoded sound data. */
async function generateSoundData(sounds: SoundInfo[]): Promise<string | null> {
  const data = await Promise.all(
    sounds.map(({ filename }) => processSound(filename)),
  );
  if (data.some(x => x == null)) {
    return null;
  }
  return data.join(' ');
}

/** Process a score, returning the data as a string if successful. */
async function processScore(
  filename: string,
  sounds: ReadonlyMap<string, number>,
): Promise<string | null> {
  const source = await fs.promises.readFile(filename, 'utf8');
  let data: Uint8Array;
  try {
    const score = parseScore(source);
    for (const sound of score.sounds) {
      if (!sounds.has(sound.name)) {
        throw new SourceError(
          sound.locs[0] || noSourceLocation,
          `unknown sound ${JSON.stringify(sound.name)}`,
        );
      }
    }
    data = score.emit(sounds);
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

/** Process all music, returning the encoded music data. */
async function generateMusicData(
  music: SoundInfo[],
  sounds: SoundInfo[],
): Promise<string | null> {
  const nameMap = new Map<string, number>();
  for (let index = 0; index < sounds.length; index++) {
    const { name } = sounds[index];
    nameMap.set(name.toLowerCase(), index);
  }
  const data = await Promise.all(
    music.map(({ filename }) => processScore(filename, nameMap)),
  );
  if (data.some(x => x == null)) {
    return null;
  }
  return data.join(' ');
}

/** Generate the audio definitions file. */
async function generateSources(
  config: Config,
  params: PackAudioParameters,
): Promise<boolean> {
  const sounds = listSounds(params.sounds);
  const music = listSounds(params.music);
  let outData: Promise<boolean> | null = null;
  if (config != Config.Debug) {
    outData = (async () => {
      const texts = await Promise.all([
        generateSoundData(sounds),
        generateMusicData(music, sounds),
      ]);
      if (texts.some(x => x == null)) {
        return false;
      }
      await fs.promises.writeFile(
        soundsDataPath,
        JSON.stringify(texts),
        'utf8',
      );
      return true;
    })();
  }
  const defs = prettifyTypeScript(generateDefs(sounds, music));
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
    return [...this.params.sounds, ...this.params.music];
  }
  get outputs(): readonly string[] {
    const outputs = [defsFile];
    if (this.config != Config.Debug) {
      outputs.push(soundsDataPath);
    }
    return outputs;
  }

  /** Pack the audio programs and emit loading stubs. */
  execute(config: BuildArgs): Promise<boolean> {
    return generateSources(config.config, this.params);
  }
}

/** Parameters for the PackAudio build step. */
export interface PackAudioParameters {
  /** A list of all input audio programs. */
  sounds: readonly string[];
  /** A list of all music scores. */
  music: readonly string[];
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
    const sounds = listFilesWithExtensions('audio', ['.lisp']);
    const music = listFilesWithExtensions('music', ['.txt']);
    status = await generateSources(Config.Debug, { sounds, music });
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
