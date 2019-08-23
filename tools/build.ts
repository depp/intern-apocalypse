/**
 * Main build script.
 * @module tools/build
 */

import * as program from 'commander';
import chalk from 'chalk';

import { BuildContext, Builder } from './action';
import { Config, BuildArgs } from './config';
import { evalHTML } from './html';
import { projectName, sizeTarget } from './info';
import { rollupJS } from './rollup';
import { serve } from './server';
import { compileTS } from './typescript';
import { pathWithExt, projectRoot, mkdir, removeAll } from './util';
import { createZip } from './zip';

/**
 * Create the build actions.
 */
function emitActions(ctx: BuildContext) {
  const tsSources = ctx.listFilesWithExtensions('src', ['.ts']);
  compileTS(ctx, {
    outDir: 'build/src',
    inputs: tsSources,
    config: 'src/tsconfig.json',
    rootNames: ['src/main.debug.ts', 'src/main.release.ts'],
  });
  rollupJS(ctx, {
    output: 'build/game.js',
    inputs: tsSources.map(src => 'build/' + pathWithExt(src, '.js')),
    name:
      ctx.config.config == Config.Debug ? 'src/main.debug' : 'src/main.release',
    global: 'Game',
    external: [],
  });
  if (ctx.config.config == Config.Release) {
    evalHTML(ctx, {
      output: 'build/index.html',
      template: 'html/static.html',
      script: 'build/game.js',
      title: projectName,
    });
    createZip(ctx, {
      output: 'build/InternApocalypse.zip',
      files: new Map([['index.html', 'build/index.html']]),
      sizeTarget,
    });
  }
}

/**
 * Create the build actions for the loader.
 */
function emitLoaderActions(ctx: BuildContext) {
  const tsSources = ctx.listFilesWithExtensions('tools/loader', [
    '.ts',
    '.tsx',
  ]);
  compileTS(ctx, {
    outDir: 'build/tools/loader',
    inputs: tsSources,
    config: 'tools/loader/tsconfig.json',
    rootNames: ['tools/loader/loader.ts'],
  });
  rollupJS(ctx, {
    output: 'build/loader.js',
    inputs: tsSources.map(src => 'build/' + pathWithExt(src, '.js')),
    name: 'tools/loader/loader',
    global: 'Loader',
    external: [],
  });
}

/** Parse an integer command-line option. */
function parseIntArg(value: any, prev: any): number {
  return parseInt(value, 10);
}

/** Parse a build config command-line option. */
function parseConfig(value: any, prev: any): Config {
  const s = (value as string).toLowerCase();
  for (const x in Config) {
    if (typeof x == 'string' && x.toLowerCase() == s) {
      return Config[x as keyof typeof Config];
    }
  }
  throw new Error(`unknown config ${JSON.stringify(value)}`);
}

/** Main entry point for build script. */
async function main(): Promise<void> {
  program
    .option(
      '--config <config>',
      'set the build configuration (debug, release)',
      parseConfig,
    )
    .option('--serve', 'serve the project over HTTP')
    .option('--watch', 'rebuild project as inputs change')
    .option('--show-build-times', 'show how long it takes to build each step')
    .option('--port <port>', 'port for HTTP server', parseIntArg)
    .option('--host <host>', 'host for HTTP server');
  program.parse(process.argv);
  // This gives us the right types for TypeScript.
  const args: BuildArgs = {
    config: program.serve ? Config.Debug : Config.Release,
    serve: false,
    watch: false,
    showBuildTimes: false,
    port: 7000,
    host: 'localhost',
  };
  for (const arg of Object.keys(args)) {
    if (arg in program) {
      // @ts-ignore
      args[arg] = program[arg];
    }
  }

  try {
    process.chdir(projectRoot);
    await mkdir('build');
    await removeAll('build/tmp');
    await mkdir('build/tmp');
    const builder = new Builder(emitActions, 'src', args);
    if (args.serve) {
      const loadBuilder = new Builder(
        emitLoaderActions,
        'tools/loader',
        Object.assign({}, args, { config: Config.Debug }),
      );
      serve(Object.assign({ builder, loadBuilder }, args));
      loadBuilder.watch();
      builder.watch();
    } else if (args.watch) {
      builder.watch();
    } else {
      console.log('Building...');
      const success = await builder.build();
      if (!success) {
        console.log(`Build: ${chalk.red.bold('FAILED')}`);
        process.exit(1);
      }
      console.log(`Build: ${chalk.green('success')}`);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
