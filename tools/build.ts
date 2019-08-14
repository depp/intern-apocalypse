/**
 * Main build script.
 * @module tools/build
 */

import { buildHTML } from './html';
import { rollupJS } from './rollup';
import { compileTS } from './typescript';
import * as util from './util';
import { buildZip } from './zip';

/** Competition zip file size limit. */
const sizeTarget = 13 * 1024;

/** Main entry point for build script. */
async function main() {
  try {
    process.chdir(util.projectRoot);
    await util.mkdir('build');
    await util.removeAll('build/tmp');
    await util.mkdir('build/tmp');
    compileTS();
    await rollupJS();
    await buildHTML();
    await buildZip(sizeTarget);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
