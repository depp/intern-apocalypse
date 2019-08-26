/**
 * Build rules for bundling JavaScript code using rollup.js.
 */

import * as fs from 'fs';
import * as path from 'path';

import * as rollup from 'rollup';
import * as terserTypes from 'terser'; // Only load if needed.

import { BuildAction, BuildContext } from './action';
import { BuildArgs, Config } from './config';

/** An error for failure to resolve an imported module. */
class ResolutionFailure extends Error {
  constructor(module: string, msg: string) {
    super(
      `could not resolve module reference to ${JSON.stringify(module)}: ${msg}`,
    );
  }
}

/**
 * Resolve a module path relative to a directory.
 * @returns The resolved path, relative to the project root.
 */
function resolveModuleRelative(baseDir: string, module: string): string {
  if (module == '') {
    throw new ResolutionFailure(module, 'path is empty');
  }
  const parts = baseDir.split('/');
  const rparts = module.split('/');
  if (rparts[0] != '.' && rparts[0] != '..') {
    throw new ResolutionFailure(module, 'path is not relative');
  }
  if (rparts[rparts.length - 1] == '') {
    throw new ResolutionFailure(module, 'path ends with slash');
  }
  let isDir = true;
  for (const part of rparts) {
    if (part.startsWith('.')) {
      switch (part) {
        case '.':
          isDir = true;
          break;
        case '..':
          if (parts.length == 0) {
            throw new ResolutionFailure(module, 'path escapes project root');
          }
          parts.pop();
          isDir = true;
          break;
        default:
          throw new ResolutionFailure(
            module,
            `component ${JSON.stringify(part)} starts with period`,
          );
      }
    } else if (part == '') {
      throw new ResolutionFailure(module, 'path contains double slash');
    } else {
      parts.push(part);
      isDir = false;
    }
  }
  if (isDir) {
    throw new ResolutionFailure(module, 'path is a directory');
  }
  return parts.join('/');
}

/** Rollup plugin for resolving and loading game modules. */
const resolverPlugin: rollup.Plugin = {
  name: 'Resolver',
  resolveId(
    source: string,
    importer: string | undefined,
  ): rollup.ResolveIdResult {
    if (importer != null) {
      return resolveModuleRelative(path.dirname(importer), source);
    } else {
      // Top-level main module, 'input' above.
      return source;
    }
  },
  async load(id: string): Promise<rollup.SourceDescription> {
    const srcPath = path.join('build', id + '.js');
    const code = await fs.promises.readFile(srcPath, 'utf8');
    const result: rollup.SourceDescription = { code };
    try {
      result.map = await fs.promises.readFile(srcPath + '.map', 'utf8');
    } catch (e) {
      if (e.code != 'ENOENT') {
        throw e;
      }
    }
    return result;
  },
};

/** Create a Rollup plugin for minifying code. */
function minifyPlugin(): rollup.Plugin {
  const terser = require('terser') as typeof terserTypes;
  return {
    name: 'Terser',
    renderChunk(input: string): { code: string; map?: rollup.SourceMapInput } {
      const { code, map } = terser.minify(input, {
        ecma: 9, // 2018
        module: true,
        compress: {
          // @ts-ignore: missing from @types
          booleans_as_integers: true,
          defaults: true,
          drop_console: true,
          module: true,
          pure_getters: true,
          toplevel: true,
          unsafe: true,
          unsafe_arrows: true,
        },
        mangle: {},
        sourceMap: true,
      });
      if (!code) {
        throw new Error('terser failed');
      }
      return { code, map };
    },
  };
}

/** Information about a JavaScript module. */
export interface Module {
  /** The JavaScript module name. */
  readonly name: string;
  /** The global variable */
  readonly global: string;
}

/** Parameters for the RollupJS build step. */
export interface RollupJSParameters extends Module {
  /** A list of all input modules. */
  inputs: readonly string[];
  /** The output bundle file. */
  readonly output: string;
  /** A list of external modules this bundle imports. */
  readonly external: readonly Module[];
}

/**
 * Build step which bundles JavaScript modules into a single file.
 */
class RollupJS implements BuildAction {
  private readonly params: RollupJSParameters;

  constructor(params: RollupJSParameters) {
    this.params = params;
  }

  get name(): string {
    return `RollupJS ${this.params.output}`;
  }
  get inputs(): readonly string[] {
    return this.params.inputs;
  }
  get outputs(): readonly string[] {
    return [this.params.output];
  }

  /** Build the bundled JavaScript code. */
  async execute(config: BuildArgs): Promise<boolean> {
    const { params } = this;
    const external: string[] = [];
    const globals: { [name: string]: string } = {};
    for (const mod of params.external) {
      external.push(mod.name);
      globals[mod.name] = mod.global;
    }
    const inputOptions: rollup.InputOptions = {
      input: params.name,
      plugins: [resolverPlugin],
      external,
    };
    if (config.config == Config.Release) {
      inputOptions.plugins!.push(minifyPlugin());
    }
    const bundle = await rollup.rollup(inputOptions);
    const outputOptions: rollup.OutputOptions = {
      format: 'module',
      name: params.global,
      sourcemap: true,
      globals: globals,
    };
    const { output } = await bundle.generate(outputOptions);
    const { code, map } = output[0];
    await fs.promises.writeFile(params.output, code);
    if (map) {
      await fs.promises.writeFile(params.output + '.map', map);
    }
    return true;
  }
}

/** Emit build actions to bundle JavaScript code. */
export function rollupJS(ctx: BuildContext, params: RollupJSParameters): void {
  ctx.addAction(new RollupJS(params));
}
