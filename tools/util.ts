/**
 * Utility functions for build script.
 * @module tools/util
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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
