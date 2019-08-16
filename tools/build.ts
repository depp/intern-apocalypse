/**
 * Main build script.
 * @module tools/build
 */

import * as minimist from 'minimist';

import { BuildContext, ActionCreator, Builder, Watcher } from './action';
import { EvalHTML } from './html';
import { RollupJS } from './rollup';
import { serve, ServerOptions } from './server';
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
  const args = (minimist(process.argv.slice(2), {
    boolean: ['serve', 'watch'],
    string: ['host'],
    default: {
      host: 'localhost',
      port: 7000,
    },
    unknown(arg: string): boolean {
      console.error(`Unknown argument ${JSON.stringify(arg)}`);
      return process.exit(2); // Return to satisfy type checker.
    },
  }) as unknown) as {
    serve: boolean;
    watch: boolean;
  } & ServerOptions;

  try {
    process.chdir(util.projectRoot);
    await util.mkdir('build');
    await util.removeAll('build/tmp');
    await util.mkdir('build/tmp');
    const builder = new Builder(makeActionCreator());
    if (args.serve) {
      console.log('Building...');
      await builder.build();
      serve(args);
    } else if (args.watch) {
      const watcher = new Watcher(builder);
      watcher.watch();
    } else {
      console.log('Building...');
      await builder.build();
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
