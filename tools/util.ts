/**
 * Utility functions for build script.
 * @module tools/util
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import * as prettierTypes from 'prettier';

/** Path to root directory containing the project. */
export const projectRoot = path.dirname(__dirname);

/** Create a directory if it does not already exist. */
export async function mkdir(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath);
  } catch (e) {
    if (e.code != 'EEXIST') {
      throw e;
    }
  }
}

/** Delete a directory and all its contents, recursively. */
async function rmdirRecursive(dirPath: string): Promise<void> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await rmdirRecursive(entryPath);
    } else {
      await fs.promises.unlink(entryPath);
    }
  }
  await fs.promises.rmdir(dirPath);
}

/** Remove files or directories and all their contents, if they exist. */
export async function removeAll(...objPaths: string[]): Promise<void> {
  for (const objPath of objPaths) {
    let st: fs.Stats;
    try {
      st = await fs.promises.stat(objPath);
    } catch (e) {
      if (e.code == 'ENOENT') {
        continue;
      }
      throw e;
    }
    if (st.isDirectory()) {
      await rmdirRecursive(objPath);
    } else {
      await fs.promises.unlink(objPath);
    }
  }
}

/** Run a subprocess and return the exit status. */
export function runProcess(
  command: string,
  args: readonly string[],
  options?: child_process.SpawnOptions,
): Promise<number> {
  const spawnOptions: child_process.SpawnOptions = {
    stdio: ['ignore', 'inherit', 'inherit'],
  };
  if (options != null) {
    Object.assign(spawnOptions, options);
  }
  const proc = child_process.spawn(command, args, spawnOptions);
  return new Promise<number>(function(resolve, reject) {
    proc.on('exit', function(code, signal) {
      if (signal != null) {
        reject(
          new Error(`Command ${command} terminated with signal ${signal}`),
        );
      } else {
        // Documented that either code or signal is not null.
        resolve(code!);
      }
    });
    proc.on('error', function(e: NodeJS.ErrnoException) {
      if (e.code == 'ENOENT') {
        reject(new Error(`Command not found: ${command}`));
      } else {
        reject(e);
      }
    });
  });
}

/** Counter for temporary build files. */
let tempCounter = 0;

/** Create a unique path which can be used for temporary files. */
export function tempPath(): string {
  const n = tempCounter++;
  return `build/tmp/${n}`;
}

/** Flag for listing files recursively. */
export const recursive = Symbol('recursive');

/** Get the extension for a path, including the leading dot. */
export function pathExt(name: string): string {
  // This works even when result = -1.
  const basenameStart = name.lastIndexOf('/') + 1;
  const extStart = name.lastIndexOf('.');
  if (extStart <= basenameStart) {
    return '';
  }
  return name.substring(extStart);
}

/**
 * Replace the paths extension, if any, with a different extension. The
 * extension should include the leading dot.
 */
export function pathWithExt(name: string, ext: string): string {
  // This works even when result = -1.
  const basenameStart = name.lastIndexOf('/') + 1;
  const extStart = name.lastIndexOf('.');
  if (extStart <= basenameStart) {
    return name + ext;
  }
  return name.substring(0, extStart) + ext;
}

/**
 * List files in a given directory with the given extensions. Results will start
 * with the path to the base directory. The extensions should include the
 * leading dot. Files and directories starting with '.' will be skipped.
 */
export function listFilesWithExtensions(
  dirpath: string,
  exts: ReadonlyArray<string>,
  flag?: typeof recursive,
): string[] {
  const result: string[] = [];
  function scanDir(curpath: string) {
    const objs = fs.readdirSync(curpath, { withFileTypes: true });
    for (const obj of objs) {
      const { name } = obj;
      if (!name.startsWith('.')) {
        if (obj.isFile()) {
          if (exts.includes(pathExt(name))) {
            result.push(path.join(curpath, name));
          }
        } else if (flag == recursive && obj.isDirectory()) {
          scanDir(path.join(curpath, name));
        }
      }
    }
  }
  scanDir(dirpath);
  return result;
}

/** Regular expression for names that can be converted to TitleCase. */
export const validName = /^[A-Za-z][-_A-Za-z0-9]$/;

/** A name, converted for source code identifier conventions. */
export interface Names {
  /** Name, in UpperCamelCase format. */
  upperCase: string;
  /** Name, in lowerCamelCase format. */
  lowerCase: string;
}

/** Convert an ASCII string to UpperCamelCase and lowerCamelCase. */
export function convertName(text: string): Names {
  const segment = /[-_.]*([0-9]+|[A-Za-z][a-z]*)[-_.]*/y;
  let match: RegExpMatchArray | null;
  let upperCase = '';
  let pos = 0;
  while ((match = segment.exec(text)) != null) {
    const part = match[1];
    upperCase += part.charAt(0).toUpperCase();
    upperCase += part.substring(1);
    pos = segment.lastIndex;
  }
  if (pos != text.length) {
    const codepoint = String.fromCodePoint(text.codePointAt(pos)!);
    throw new Error(
      `unexpected character in name: ${JSON.stringify(codepoint)}`,
    );
  }
  if (upperCase == '') {
    throw new Error(
      `name does not contain alphanumeric characters: ${JSON.stringify(text)}`,
    );
  }
  if (upperCase.charAt(0) >= '0' && upperCase.charAt(0) <= '9') {
    throw new Error(`name starts with digit: ${JSON.stringify(text)}`);
  }
  const lowerCase = upperCase.charAt(0).toLowerCase() + upperCase.substring(1);
  return {
    upperCase,
    lowerCase,
  };
}

/** Header for generated source files. */
export const generatedHeader = '/* This code is automatically generated. */\n';

/** Prettify TypeScript code. */
export function prettifyTypeScript(source: string): string {
  const prettier = require('prettier') as typeof prettierTypes;
  return prettier.format(source, {
    parser: 'typescript',
    singleQuote: true,
    trailingComma: 'all',
  });
}
