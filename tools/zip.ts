/**
 * Build rules for creating zip file packages.
 * @module tools/zip
 */

import * as fs from 'fs';
import * as path from 'path';

import chalk from 'chalk';

import * as util from './util';
import { BuildContext } from './action';

/**
 * Create a zip file containing the given files.
 * @returns Size of the zip file, in bytes.
 */
async function createZip(
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

/** Input to the CreateZip build step. */
export interface ZipInput {
  sizeTarget: number;
  files: ReadonlyMap<string, string>;
}

/** Input to the CreateZip build step. */
export interface ZipOutput {
  zip: string;
}

/**
 * Build step which creates a zip archive.
 */
export class CreateZip {
  createActions(ctx: BuildContext, input: ZipInput): ZipOutput {
    const { sizeTarget, files } = input;
    const zip = 'build/InternApocalypse.zip';

    ctx.addAction({
      name: 'Zip',
      inputs: [...files.values()],
      outputs: [zip],
      execute: () => this.createZip({ zip, files, sizeTarget }),
    });

    return { zip };
  }

  /** Build the packaged zip file. */
  private async createZip(input: {
    zip: string;
    files: ReadonlyMap<string, string>;
    sizeTarget: number;
  }): Promise<void> {
    const { zip, files, sizeTarget } = input;
    const size = await createZip(zip, files);
    const percentSize = ((100 * size) / sizeTarget).toFixed(2);
    const withinTarget =
      size <= sizeTarget ? chalk.green('yes') : chalk.red.bold('NO');
    process.stderr.write(
      `Zip file size: ${size} (${percentSize}% of target)\n` +
        `Within size limit: ${withinTarget}\n`,
    );
  }
}
