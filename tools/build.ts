/**
 * Main build script.
 * @module tools/build
 */

import { BuildContext, ActionCreator, Builder } from './action';
import { EvalHTML } from './html';
import { RollupJS } from './rollup';
import { CompileTS } from './typescript';
import * as util from './util';
import { CreateZip } from './zip';

/** Competition zip file size limit. */
const sizeTarget = 13 * 1024;

/**
 * Create a function which creates build actions.
 */
function makeActionCreator(): ActionCreator {
  const compileTS = new CompileTS();
  const rollupJS = new RollupJS();
  const evalHTML = new EvalHTML();
  const createZip = new CreateZip();
  return (ctx: BuildContext) => {
    const { jsModules } = compileTS.createActions(ctx);
    const { jsBundle } = rollupJS.createActions(ctx, { jsModules });
    const { html } = evalHTML.createActions(ctx, { script: jsBundle });
    createZip.createActions(ctx, {
      sizeTarget,
      files: new Map([['index.html', html]]),
    });
  };
}

/** Main entry point for build script. */
async function main() {
  try {
    process.chdir(util.projectRoot);
    await util.mkdir('build');
    await util.removeAll('build/tmp');
    await util.mkdir('build/tmp');
    const createActions = makeActionCreator();
    const builder = new Builder();
    await builder.build(createActions);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
