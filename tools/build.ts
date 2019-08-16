/**
 * Main build script.
 * @module tools/build
 */

import * as program from 'commander';

import { BuildContext, ActionCreator, Builder } from './action';
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

/** Parse an integer command-line option. */
function parseIntArg(value: any, prev: any): number {
  return parseInt(value, 10);
}

/** Get the given flag value or a default value. */
function flagValue<T>(name: string, defaultValue: T): T {
  return name in program ? program[name] : defaultValue;
}

/** Main entry point for build script. */
async function main(): Promise<void> {
  program
    .option('--serve', 'serve the project over HTTP')
    .option('--watch', 'rebuild project as inputs change')
    .option('--show-build-times', 'show how long it takes to build each step')
    .option('--port <port>', 'port for HTTP server', parseIntArg)
    .option('--host <host>', 'host for HTTP server');
  program.parse(process.argv);
  // This gives us the right types for TypeScript.
  const args = {
    serve: false,
    watch: false,
    showBuildTimes: false,
    port: 7000,
    host: 'localhost',
  };
  for (const arg of Object.keys(args)) {
    if (arg in program) {
      // @ts-ignore: Hack
      args[arg] = program[arg];
    }
  }

  try {
    process.chdir(util.projectRoot);
    await util.mkdir('build');
    await util.removeAll('build/tmp');
    await util.mkdir('build/tmp');
    const builder = new Builder(makeActionCreator(), args);
    if (args.serve) {
      console.log('Building...');
      builder.watch();
      serve(args);
    } else if (args.watch) {
      builder.watch();
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
