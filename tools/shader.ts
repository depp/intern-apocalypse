/**
 * Generate shader loading code.
 */

import * as fs from 'fs';
import * as path from 'path';

import * as prettierTypes from 'prettier';

import { BuildAction, BuildContext } from './action';
import { BuildArgs } from './config';
import { loadShaders } from './shader.syntax';
import { readPrograms, programSources } from './shader.programs';
import { emitLoader } from './shader.emit';

const dirname = 'shader';

async function generateLoader(): Promise<void> {
  const programs = await readPrograms(path.join(dirname, 'programs.json'));
  const sources = programSources(programs);
  const shaders = await loadShaders(dirname, sources);
  const out = emitLoader(programs, shaders);
  const prettier = require('prettier') as typeof prettierTypes;
  const prettyOut = prettier.format(out, {
    parser: 'typescript',
    singleQuote: true,
    trailingComma: 'all',
  });
  await fs.promises.writeFile('src/shaders.ts', prettyOut, 'utf8');
}

/**
 * Build step which packs the GLSL shaders into JavaScript code.
 */
class PackShaders implements BuildAction {
  private readonly params: PackShadersParameters;
  constructor(params: PackShadersParameters) {
    this.params = params;
  }
  get name(): string {
    return 'PackShaders';
  }
  get inputs(): readonly string[] {
    return this.params.inputs;
  }
  get outputs(): readonly string[] {
    return ['src/shaders.ts'];
  }

  /** Pack the shaders and emit loading stubs. */
  async execute(config: BuildArgs): Promise<boolean> {
    await generateLoader();
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
  ctx.addAction(new PackShaders(params));
}

async function main(): Promise<void> {
  try {
    await generateLoader();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

if (require.main == module) {
  main();
}
