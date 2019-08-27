/**
 * Generate shader loading code.
 */

import * as fs from 'fs';
import * as path from 'path';

import * as prettierTypes from 'prettier';

import { BuildAction, BuildContext } from './action';
import { BuildArgs, Config } from './config';
import { loadShaders } from './shader.syntax';
import { readPrograms, programSources } from './shader.programs';
import { emitLoader, emitReleaseData } from './shader.emit';

const dirname = 'shader';

async function generateLoader(config: Config): Promise<void> {
  const programs = await readPrograms(path.join(dirname, 'programs.json'));
  const sources = programSources(programs);
  const code = await loadShaders(dirname, sources);
  const out = emitLoader(programs, code);
  const prettier = require('prettier') as typeof prettierTypes;
  const prettyOut = prettier.format(out, {
    parser: 'typescript',
    singleQuote: true,
    trailingComma: 'all',
  });
  let out1 = fs.promises.writeFile('src/shaders.ts', prettyOut, 'utf8');
  if (config == Config.Release) {
    const { shaders, uniforms } = emitReleaseData(programs, code);
    const out2 = fs.promises.writeFile('build/shaders.js', shaders, 'utf8');
    const out3 = fs.promises.writeFile('build/uniforms.json', uniforms, 'utf8');
    await out2;
    await out3;
  }
  await out1;
}

/**
 * Build step which packs the GLSL shaders into JavaScript code.
 */
class PackShaders implements BuildAction {
  private readonly params: PackShadersParameters;
  private readonly config: Config;
  constructor(config: Config, params: PackShadersParameters) {
    this.config = config;
    this.params = params;
  }
  get name(): string {
    return 'PackShaders';
  }
  get inputs(): readonly string[] {
    return this.params.inputs;
  }
  get outputs(): readonly string[] {
    const outputs = ['src/shaders.ts'];
    if (this.config == Config.Release) {
      outputs.push('build/shaders.js', 'build/uniforms.json');
    }
    return outputs;
  }

  /** Pack the shaders and emit loading stubs. */
  async execute(config: BuildArgs): Promise<boolean> {
    await generateLoader(config.config);
    return true;
  }
}

/** Parameters for the PackShaders build step. */
export interface PackShadersParameters {
  /** A list of all input modules. */
  inputs: readonly string[];
}

/** Emit build actions to pack shaders. */
export function packShaders(
  ctx: BuildContext,
  params: PackShadersParameters,
): void {
  ctx.addAction(new PackShaders(ctx.config.config, params));
}

async function main(): Promise<void> {
  try {
    await generateLoader(Config.Release);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

if (require.main == module) {
  main();
}
