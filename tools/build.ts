/**
 * Main build script.
 * @module tools/build
 */

import * as program from 'commander';

import { BuildContext, Builder, recursive } from './action';
import { evalHTML } from './html';
import { rollupJS } from './rollup';
import { serve } from './server';
import { compileTS } from './typescript';
import * as util from './util';
import { createZip } from './zip';

/** Competition zip file size limit. */
const sizeTarget = 13 * 1024;

/**
 * Create the build actions.
 */
function emitActions(ctx: BuildContext) {
  const tsSources = ctx.listFilesWithExtensions('src', ['.ts'], recursive);
  compileTS(ctx, {
    outDir: 'build/src',
    inputs: tsSources,
    config: 'src/tsconfig.json',
    rootNames: ['src/main.ts'],
  });
  rollupJS(ctx, {
    output: 'build/game.js',
    inputs: tsSources.map(src => 'build/' + util.pathWithExt(src, '.js')),
    name: 'src/main',
    global: 'Game',
    external: [],
  });
  evalHTML(ctx, {
    output: 'build/index.html',
    template: 'src/index.html',
    script: 'build/game.js',
    title: 'Internship at the Apocalypse',
  });
  createZip(ctx, {
    output: 'build/InternApocalypse.zip',
    files: new Map([['index.html', 'build/index.html']]),
    sizeTarget,
  });
}

/** Parse an integer command-line option. */
function parseIntArg(value: any, prev: any): number {
  return parseInt(value, 10);
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
    const builder = new Builder(emitActions, args);
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
