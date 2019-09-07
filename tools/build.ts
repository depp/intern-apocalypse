/**
 * Main build script.
 * @module tools/build
 */

import * as yargs from 'yargs';
import chalk from 'chalk';

import { BuildContext, Builder, recursive } from './action';
import { packAudio } from './audio.build';
import { Config, BuildArgs, Mode } from './config';
import { evalHTML } from './html';
import { projectName, sizeTarget } from './info';
import { createLoader } from './loader';
import { packModels } from './model.build';
import { rollupJS } from './rollup';
import { serve } from './server';
import { packShaders } from './shader';
import { compileTS } from './typescript';
import { pathWithExt, projectRoot, mkdir, removeAll } from './util';
import { createWatcher } from './watch';
import { createZip } from './zip';
import { AssertionError } from '../src/debug/debug';

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
  if (ctx.config.config == Config.Release) {
    createLoader(ctx, {});
  }
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
      useZopfli: true,
      date: new Date(2019, 9, 13, 13, 0, 0, 0),
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

/** Parse the command-line arguments. */
function parseArgs(): BuildArgs {
  const argv = yargs
    .options({
      'show-build-times': {
        type: 'boolean',
        default: false,
        desc: 'Show how long each build step takes',
      },
    })
    .command('build', 'Build a packaged zip file')
    .command('watch', 'Rebuild project as inputs change')
    .command('serve', 'Serve the project locally over HTTP', yargs =>
      yargs.option({
        'port': { type: 'number', default: 7000, desc: 'Serve on this port' },
        'host': {
          type: 'string',
          default: 'localhost',
          desc: 'Serve on this host',
        },
      }),
    )
    .help()
    .version(false)
    .strict().argv;
  const mode =
    new Map([
      ['build', Mode.Build],
      ['watch', Mode.Watch],
      ['serve', Mode.Serve],
    ]).get(argv._[0]) || Mode.Build;
  return {
    config: mode == Mode.Serve ? Config.Debug : Config.Release,
    mode,
    host: (argv.host as string) || '',
    port: (argv.port as number) || 0,
    showBuildTimes: argv['show-build-times'],
  };
}

/** Main entry point for build script. */
async function main(): Promise<void> {
  const args = parseArgs();

  try {
    process.chdir(projectRoot);
    await mkdir('build');
    await removeAll('build/tmp');
    await mkdir('build/tmp');
    const builder = new Builder(emitActions, args);
    switch (args.mode) {
      case Mode.Build:
        {
          console.log('Building...');
          const success = await builder.build();
          if (!success) {
            console.log(`Build: ${chalk.red.bold('FAILED')}`);
            process.exit(1);
          }
          console.log(`Build: ${chalk.green('success')}`);
        }
        break;
      case Mode.Watch:
        {
          const watcher = await createWatcher();
          builder.watch(watcher);
        }
        break;
      case Mode.Serve:
        {
          const watcher = await createWatcher();
          serve(Object.assign({ builder, watcher }, args));
          builder.watch(watcher);
        }
        break;
      default:
        throw new AssertionError('invalid mode', { mode: args.mode });
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
