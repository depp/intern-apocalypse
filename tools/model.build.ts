/**
 * Embed model data in game.
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
import { convertModel } from '../src/model/convert';
import { SourceError, SourceText } from '../src/lib/sourcepos';
import { printError } from './source';
import { encode } from '../src/lib/data.encode';
import { AssertionError } from '../src/debug/debug';

const defsFile = 'src/model/models.ts';
export const modelDataPath = 'build/models.json';

interface ModelInfo {
  name: string;
  filename: string;
}

/** List all models in the game. */
function listModels(params: PackModelsParameters): ModelInfo[] | null {
  const filenames = new Map<string, string>();
  for (const input of params.inputs) {
    let modelname = path.basename(input);
    const dot = modelname.indexOf('.');
    if (dot != -1) {
      modelname = modelname.substring(0, dot);
    }
    const name = convertName(modelname).upperCase;
    if (filenames.has(name)) {
      console.error(`Multiple models have name ${JSON.stringify(name)}`);
      return null;
    }
    filenames.set(name, input);
  }
  const names = Array.from(filenames.keys());
  names.sort();
  const result: ModelInfo[] = [];
  for (const name of names) {
    const filename = filenames.get(name);
    if (filename == null) {
      throw new AssertionError(`filename == null`);
    }
    result.push({ name, filename });
  }
  return result;
}

/** Generate the model definition enum from the model list. */
function generateDefs(models: ModelInfo[]): string {
  let out = '';
  out += generatedHeader;
  out += '\n';
  out += "import { Model } from './model';\n";
  out += '\n';
  out += '/** Model asset identifiers. */\n';
  out += 'export const enum ModelAsset {\n';
  for (const { name } of models) {
    out += `  ${name},\n`;
  }
  out += '}\n';
  out += '\n';
  out += '/** Get list of model filenames, in order. */\n';
  out += 'export function getModelNames(): string[] {\n';
  out += `  return ${JSON.stringify(models.map(m => m.filename))};\n`;
  out += '}\n';
  return out;
}

/** Process a model, returning the data as a string if successful. */
async function processModel(filename: string): Promise<string | null> {
  const source = await fs.promises.readFile(filename, 'utf8');
  let data: Uint8Array;
  try {
    data = convertModel(source);
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

/** Process all models, returning the source of the model data file. */
async function generateData(models: ModelInfo[]): Promise<string | null> {
  const modelsData: Promise<string | null>[] = [];
  for (const { filename } of models) {
    modelsData.push(processModel(filename));
  }
  let data = '';
  for (const promise of modelsData) {
    const item = await promise;
    if (item == null) {
      return null;
    }
    data += ' ';
    data += item;
  }
  return JSON.stringify([data.substring(1)]);
}

/** Generate the model definitions file. */
async function generateSources(
  config: Config,
  params: PackModelsParameters,
): Promise<boolean> {
  const models = listModels(params);
  if (models == null) {
    return false;
  }
  let outData: Promise<boolean> | null = null;
  if (config == Config.Release) {
    outData = (async () => {
      const text = await generateData(models);
      if (text == null) {
        return false;
      }
      await fs.promises.writeFile(modelDataPath, text, 'utf8');
      return true;
    })();
  }
  const defs = prettifyTypeScript(generateDefs(models));
  await fs.promises.writeFile(defsFile, defs, 'utf8');
  if (outData) {
    return await outData;
  }
  return true;
}

/**
 * Build step which packs the GLSL shaders into JavaScript code.
 */
class PackModels implements BuildAction {
  private readonly params: PackModelsParameters;
  private readonly config: Config;
  constructor(config: Config, params: PackModelsParameters) {
    this.config = config;
    this.params = params;
  }
  get name(): string {
    return 'PackModels';
  }
  get inputs(): readonly string[] {
    return this.params.inputs;
  }
  get outputs(): readonly string[] {
    const outputs = [defsFile];
    if (this.config == Config.Release) {
      outputs.push(modelDataPath);
    }
    return outputs;
  }

  /** Pack the models and emit loading stubs. */
  async execute(config: BuildArgs): Promise<boolean> {
    await generateSources(config.config, this.params);
    return true;
  }
}

/** Parameters for the PackModels build step. */
export interface PackModelsParameters {
  /** A list of all input models. */
  inputs: readonly string[];
}

/** Emit build actions to pack models. */
export function packModels(
  ctx: BuildContext,
  params: PackModelsParameters,
): void {
  ctx.addAction(new PackModels(ctx.config.config, params));
}

async function main(): Promise<void> {
  let status = false;
  try {
    const inputs = listFilesWithExtensions('model', ['.txt']);
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
