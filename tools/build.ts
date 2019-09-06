/**
 * Main build script.
 * @module tools/build
 */

import * as program from 'commander';
import chalk from 'chalk';

import { BuildContext, Builder, recursive } from './action';
import { packAudio } from './audio.build';
import { Config, BuildArgs } from './config';
import { evalHTML } from './html';
import { projectName, sizeTarget } from './info';
import { packModels } from './model.build';
import { rollupJS } from './rollup';
import { serve } from './server';
import { packShaders } from './shader';
import { compileTS } from './typescript';
import { pathWithExt, projectRoot, mkdir, removeAll } from './util';
import { createWatcher } from './watch';
import { createZip } from './zip';

/**
 * Create the build actions.
 */
function emitActions(ctx: BuildContext) {
  const shaderSources = ctx.listFilesWithExtensions('shader', [
    '.frag',
    '.vert',
  ]);
  packShaders(ctx, {
    inputs: shaderSources,
  });
  const modelSources = ctx.listFilesWithExtensions('model', ['.txt']);
  packModels(ctx, {
    inputs: modelSources,
  });
  const audioSources = ctx.listFilesWithExtensions('audio', ['.lisp']);
  packAudio(ctx, {
    inputs: audioSources,
  });
  const tsSources = ctx.listFilesWithExtensions('src', ['.ts'], recursive);
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
    const builder = new Builder(emitActions, args);
    if (args.serve) {
      const watcher = await createWatcher();
      serve(Object.assign({ builder, watcher }, args));
      builder.watch(watcher);
    } else if (args.watch) {
      const watcher = await createWatcher();
      builder.watch(watcher);
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
