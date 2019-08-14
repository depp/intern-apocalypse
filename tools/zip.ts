/**
 * Build rules for creating zip file packages.
 * @module tools/zip
 */

import * as fs from 'fs';
import * as path from 'path';

import chalk from 'chalk';

import * as util from './util';

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

/** Build the packaged zip file. */
export async function buildZip(sizeTarget: number): Promise<void> {
  const zipPath = 'build/InternApocalypse.zip';
  const size = await createZip(
    zipPath,
    new Map([['index.html', 'build/index.html']]),
  );
  const percentSize = ((100 * size) / sizeTarget).toFixed(2);
  const withinTarget =
    size <= sizeTarget ? chalk.green('yes') : chalk.red.bold('NO');
  process.stderr.write(
    `Zip file size: ${size} (${percentSize}% of target)\n` +
      `Within size limit: ${withinTarget}\n`,
  );
}
