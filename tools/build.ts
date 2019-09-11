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
import { createLoader, dataPath } from './loader';
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
  const musicSources = ctx.listFilesWithExtensions('music', ['.txt']);
  packAudio(ctx, {
    sounds: audioSources,
    music: musicSources,
  });
  if (ctx.config.config != Config.Debug) {
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
  switch (ctx.config.config) {
    case Config.Release:
      evalHTML(ctx, {
        output: 'build/index.html',
        template: 'html/release.html',
        title: projectName,
      });
      createZip(ctx, {
        output: 'build/InternApocalypse_Release.zip',
        files: new Map([
          ['index.html', 'build/index.html'],
          ['game.js', 'build/game.js'],
          ['game.js.map', 'build/game.js.map'],
          ['data.json', 'build/data.json'],
          ['style.css', 'html/style.css'],
        ]),
      });
      break;
    case Config.Competition:
      evalHTML(ctx, {
        output: 'build/index.html',
        template: 'html/competition.html',
        script: 'build/game.js',
        data: dataPath,
        title: projectName,
      });
      createZip(ctx, {
        output: 'build/InternApocalypse_JS13K.zip',
        files: new Map([['index.html', 'build/index.html']]),
        sizeTarget,
        useZopfli: true,
        date: new Date(2019, 9, 13, 13, 0, 0, 0),
      });
      break;
  }
}

/** Parse the command-line arguments. */
function parseArgs(): BuildArgs {
  const configs = new Map<string, Config>([
    ['debug', Config.Debug],
    ['release', Config.Release],
    ['competition', Config.Competition],
  ]);
  const argv = yargs
    .options({
      'config': {
        type: 'string',
        choices: Array.from(configs.keys()),
        desc: 'Build configuration',
      },
      'show-build-times': {
        type: 'boolean',
        default: false,
        desc: 'Show how long each build step takes',
      },
      'minify': {
        type: 'boolean',
        default: true,
        desc: 'Allow aggressive minification with Terser',
      },
      'beautify': {
        type: 'boolean',
        default: false,
        desc: 'Beautify code (does not work with source maps)',
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
  let config: Config | undefined;
  if (argv.config) {
    config = configs.get(argv.config);
    if (config == null) {
      throw new AssertionError('unknown config');
    }
    if (config == Config.Debug && mode != Mode.Serve) {
      console.error('debug config can only be used with local server');
      process.exit(2);
    }
  } else {
    config = mode == Mode.Serve ? Config.Debug : Config.Competition;
  }
  return {
    config,
    mode,
    host: (argv.host as string) || '',
    port: (argv.port as number) || 0,
    showBuildTimes: argv['show-build-times'],
    minify: argv.minify,
    beautify: argv.beautify,
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
