/**
 * Release build loader generator.
 */

import * as fs from 'fs';

import { BuildAction, BuildContext, BuildError } from './action';
import { soundsDataPath } from './audio.build';
import { BuildArgs } from './config';
import { modelDataPath } from './model.build';
import { generatedHeader } from './util';
import { shaderDataPath } from './shader';

interface Source {
  name: string;
  filepath: string;
}

const sources: Source[] = [
  { name: 'shader', filepath: shaderDataPath },
  { name: 'sound', filepath: soundsDataPath },
  { name: 'model', filepath: modelDataPath },
];

export const dataPath = 'build/data.json';
export const loaderPath = 'build/loader.js';

interface LoadedSource extends Source {
  data: string[];
}

/** Read a single data source. */
export async function readSource(source: Source): Promise<LoadedSource> {
  const { filepath } = source;
  const body = await fs.promises.readFile(filepath, 'utf8');
  const data = JSON.parse(body);
  if (!Array.isArray(data) || data.some(x => typeof x != 'string')) {
    throw new BuildError(`${filepath}: not an array of strings`);
  }
  return Object.assign({ data: data as string[] }, source);
}

/** Parameters for the createLoader build step. */
export interface LoaderParameters {}

class CreateLoader implements BuildAction {
  private readonly params: LoaderParameters;

  constructor(params: LoaderParameters) {
    this.params = params;
  }

  get name(): string {
    return 'CreateLoader';
  }
  get inputs(): readonly string[] {
    return sources.map(({ filepath }) => filepath);
  }
  get outputs(): readonly string[] {
    return [dataPath, loaderPath];
  }

  /** Build the bundled JavaScript code. */
  async execute(config: BuildArgs): Promise<boolean> {
    const promises: Promise<LoadedSource>[] = [];
    for (const source of sources) {
      promises.push(readSource(source));
    }
    const data: string[] = [];
    let loader = '';
    loader += generatedHeader;
    for (const source of await Promise.all(promises)) {
      loader += `export const ${source.name}Offset = ${data.length};\n`;
      data.push(...source.data);
    }
    const out1 = fs.promises.writeFile(dataPath, JSON.stringify(data), 'utf8');
    const out2 = fs.promises.writeFile(loaderPath, loader, 'utf8');
    await out1;
    await out1;
    return true;
  }
}

/** Emit build actions to create the release build loader. */
export function createLoader(
  ctx: BuildContext,
  params: LoaderParameters,
): void {
  ctx.addAction(new CreateLoader(params));
}
