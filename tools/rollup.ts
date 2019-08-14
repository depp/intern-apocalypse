/**
 * Build rules for bundling JavaScript code using rollup.js.
 * @module tools/rollup
 */

import * as fs from 'fs';
import * as path from 'path';

import * as rollup from 'rollup';

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
    return { code };
  },
};

/** Build the bundled JavaScript code. */
export async function rollupJS(): Promise<void> {
  const inputOptions: rollup.InputOptions = {
    input: 'src/main',
    plugins: [resolverPlugin],
  };
  const bundle = await rollup.rollup(inputOptions);
  const outputOptions: rollup.OutputOptions = {
    format: 'iife',
    name: 'Game',
    sourcemap: true,
  };
  const { output } = await bundle.generate(outputOptions);
  const { code } = output[0];
  await fs.promises.writeFile('build/game.js', code);
}
