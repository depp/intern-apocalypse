/**
 * Generate shader loading code.
 */

import * as fs from 'fs';

import { BuildAction, BuildContext } from './action';
import { BuildArgs, Config } from './config';
import { emitDefinitions, emitUniformMap } from './shader.emit';
import { minifyShaders } from './shader.minify';
import { readShaderPrograms } from './shader.programs';

const programSpecPath = 'shader/programs.json';
const shaderDefsPath = 'src/render/shaders.ts';
const uniformMapPath = 'build/uniforms.json';
export const minShaderDefsPath = 'build/shaders.js';
export const shaderDataPath = 'build/shader.json';

async function generateLoader(config: Config): Promise<void> {
  let promises: Promise<void>[] = [];
  let programs = await readShaderPrograms(programSpecPath);
  promises.push(
    fs.promises.writeFile(
      shaderDefsPath,
      emitDefinitions(programs, 'source'),
      'utf8',
    ),
  );
  if (config != Config.Debug) {
    if (config == Config.Competition) {
      programs = minifyShaders(programs);
      promises.push(
        fs.promises.writeFile(
          minShaderDefsPath,
          emitDefinitions(programs, 'release'),
          'utf8',
        ),
      );
      promises.push(
        fs.promises.writeFile(uniformMapPath, emitUniformMap(programs), 'utf8'),
      );
    }
    const sources: string[] = [];
    for (const { source, index } of programs.shaders.values()) {
      sources[index] = source;
    }
    promises.push(
      fs.promises.writeFile(shaderDataPath, JSON.stringify(sources), 'utf8'),
    );
  }
  await Promise.all(promises);
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
    return [programSpecPath, ...this.params.inputs];
  }
  get outputs(): readonly string[] {
    const outputs = [shaderDefsPath];
    if (this.config != Config.Debug) {
      outputs.push(shaderDataPath);
    }
    if (this.config == Config.Competition) {
      outputs.push(minShaderDefsPath, uniformMapPath);
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
  const args = process.argv.slice(2);
  if (args.length) {
    console.error(`unexpected argument ${JSON.stringify(args[0])}`);
    process.exit(2);
  }
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
