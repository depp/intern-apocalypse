/**
 * Build rules for creating zip file packages.
 * @module tools/zip
 */

import * as fs from 'fs';
import * as path from 'path';

import chalk from 'chalk';

import * as util from './util';
import { BuildAction, BuildContext } from './action';

/**
 * Create a zip file containing the given files using InfoZip.
 * @returns Size of the zip file, in bytes.
 */
async function runInfoZip(
  zipPath: string,
  files: ReadonlyMap<string, string>,
): Promise<number> {
  const tempDir = util.tempPath();
  const tempZip = tempDir + '.zip';
  try {
    await fs.promises.mkdir(tempDir);
    const args = [path.relative(tempDir, tempZip), '--quiet', '--'];
    for (const [name, src] of files.entries()) {
      const absSrc = path.join(util.projectRoot, src);
      const absDest = path.join(tempDir, name);
      await fs.promises.symlink(absSrc, absDest);
      args.push(name);
    }
    const status = await util.runProcess('zip', args, { cwd: tempDir });
    if (status != 0) {
      throw new Error(`Command zip failed with status ${status}`);
    }
    await fs.promises.rename(tempZip, zipPath);
  } finally {
    await util.removeAll(tempDir, tempZip);
  }
  const st = await fs.promises.stat(zipPath);
  return st.size;
}

/** Specification for creating a zip file. */
export interface ZipParameters {
  readonly output: string;
  readonly files: ReadonlyMap<string, string>;
  readonly sizeTarget: number;
}

/**
 * Build action which creates a zip archive.
 */
class CreateZip implements BuildAction {
  readonly params: ZipParameters;
  constructor(params: ZipParameters) {
    this.params = params;
  }
  get name(): string {
    return `Zip ${this.params.output}`;
  }
  get inputs(): readonly string[] {
    return [...this.params.files.values()];
  }
  get outputs(): readonly string[] {
    return [this.params.output];
  }
  async execute(): Promise<void> {
    const { output, files, sizeTarget } = this.params;
    const size = await runInfoZip(output, files);
    const percentSize = ((100 * size) / sizeTarget).toFixed(2);
    const withinTarget =
      size <= sizeTarget ? chalk.green('yes') : chalk.red.bold('NO');
    process.stderr.write(
      `Zip file size: ${size} (${percentSize}% of target)\n` +
        `Within size limit: ${withinTarget}\n`,
    );
  }
}

/** Create a build action that creates a zip archive. */
export function createZip(ctx: BuildContext, params: ZipParameters) {
  ctx.addAction(new CreateZip(params));
}
