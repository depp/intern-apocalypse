/**
 * Build rules for creating zip file packages.
 * @module tools/zip
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import chalk from 'chalk';
import * as crc from 'crc';

import * as util from './util';
import { BuildAction, BuildContext } from './action';

/**
 * Create a zip file containing the given files using InfoZip.
 * @returns Size of the zip file, in bytes.
 */
async function runInfoZip(
  zipPath: string,
  files: ReadonlyMap<string, string>,
): Promise<number> {
  const tempDir = util.tempPath();
  const tempZip = tempDir + '.zip';
  try {
    await fs.promises.mkdir(tempDir);
    const args = [path.relative(tempDir, tempZip), '--quiet', '--'];
    for (const [name, src] of files.entries()) {
      const absSrc = path.join(util.projectRoot, src);
      const absDest = path.join(tempDir, name);
      await fs.promises.symlink(absSrc, absDest);
      args.push(name);
    }
    const status = await util.runProcess('zip', args, { cwd: tempDir });
    if (status != 0) {
      throw new Error(`Command zip failed with status ${status}`);
    }
    await fs.promises.rename(tempZip, zipPath);
  } finally {
    await util.removeAll(tempDir, tempZip);
  }
  const st = await fs.promises.stat(zipPath);
  return st.size;
}

/** Options to pass to Zopfli. */
interface ZopfliOptions {
  iterations?: number | null;
}

/**
 * Compress a single file using Zopfli.
 * @param filename Path to the file to compress.
 */
async function runZopfli(
  filename: string,
  options: ZopfliOptions,
): Promise<Buffer> {
  const { iterations } = options;
  const spawnOptions: child_process.SpawnOptions = {
    stdio: ['ignore', 'pipe', 'inherit'],
  };
  const args: string[] = ['-c', '--deflate'];
  if (iterations != null) {
    args.push('--i' + iterations);
  }
  args.push(filename);
  const command = 'zopfli';
  const proc = child_process.spawn(command, args, spawnOptions);
  return new Promise<Buffer>(function(resolve, reject) {
    const chunks: Buffer[] = [];
    proc.stdout!.on('data', chunk => {
      if (!(chunk instanceof Buffer)) {
        reject(new Error('chunk is not Buffer'));
      }
      chunks.push(chunk);
    });
    proc.on('exit', function(code, signal) {
      if (signal != null) {
        reject(
          new Error(`Command ${command} terminated with signal ${signal}`),
        );
      } else if (code != 0) {
        reject(new Error(`Command ${command} exited with status ${code}`));
      } else {
        resolve(Buffer.concat(chunks));
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

interface MSDOSDate {
  date: number;
  time: number;
}

function msdosDate(date: Date): MSDOSDate {
  return {
    date:
      ((date.getFullYear() - 1980) << 9) |
      (date.getMonth() << 5) |
      date.getDate(),
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      (date.getSeconds() >> 1),
  };
}

/** Python's struct.pack. */
function pack(spec: string, ...data: number[]): Buffer {
  if (spec.length != data.length) {
    throw new Error(
      `spec has length ${spec.length}, ` + `but data has length ${data.length}`,
    );
  }
  const buf = Buffer.alloc(data.length * 4);
  let offset = 0;
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    switch (spec[i]) {
      case 'H':
        buf.writeUInt16LE(item, offset);
        offset += 2;
        break;
      case 'I':
        buf.writeUInt32LE(item, offset);
        offset += 4;
        break;
      default:
        throw new Error(`unknown type ${JSON.stringify(spec[i])}`);
    }
  }
  return buf.subarray(0, offset);
}

async function makeZopfliZip(
  zipPath: string,
  files: ReadonlyMap<string, string>,
  options: ZipParameters,
): Promise<number> {
  interface File {
    data: Buffer;
    name: string;
    size: number;
  }
  const promises: Promise<File>[] = [];
  for (const [name, src] of files.entries()) {
    promises.push(
      (async () => {
        const { size } = await fs.promises.stat(src);
        const data = await runZopfli(src, options);
        return { data, name, size };
      })(),
    );
  }
  let { date } = options;
  if (!date) {
    date = new Date();
  }
  const mdate = msdosDate(date);
  const body: Buffer[] = [];
  const directory: Buffer[] = [];
  let pos = 0;
  for (const file of await Promise.all(promises)) {
    const name = Buffer.from(file.name, 'ascii');
    const fileCRC = crc.crc32(file.data);
    const fileBody = [
      pack(
        'IHHHHHIIIHH',
        0x04034b50, // signature
        20, // version needed
        0, // flags
        8, // compression method
        mdate.time, // mod time
        mdate.date, // mod date
        fileCRC, // crc-32
        file.data.length, // compressed size
        file.size, // uncompressed size
        name.length, // file name length
        0, // extra field length
      ),
      name,
      file.data,
    ];
    directory.push(
      pack(
        'IHHHHHHIIIHHHHHII',
        0x02014b50, // signature
        20, // version made by
        20, // version needed
        0, // flags
        8, // compression method
        mdate.time, // mod time
        mdate.date, // mod date
        fileCRC, // crc-32
        file.data.length, // compressed size
        file.size, // uncompressed size
        name.length, // file name length
        0, // extra field length
        0, // file comment length
        0, // disk number start
        0, // internal file attributes
        0, // external file attributes
        pos, // relative offset
      ),
    );
    directory.push(name);
    for (const buf of fileBody) {
      body.push(buf);
      pos += buf.length;
    }
  }
  let directoryLen = 0;
  for (const buf of directory) {
    directoryLen += buf.length;
  }
  directory.push(
    pack(
      'IHHHHIIH',
      0x06054b50, // signature
      0, // multi-disk
      0, // multi-disk
      files.size, // directory entry count
      files.size, // directory entry count
      directoryLen, // directory size
      pos, // directory offset
      0, // comment length
    ),
  );
  const zipData = Buffer.concat([...body, ...directory]);
  await fs.promises.writeFile(zipPath, zipData);
  return zipData.length;
}

/** Specification for creating a zip file. */
export interface ZipParameters extends ZopfliOptions {
  readonly output: string;
  readonly files: ReadonlyMap<string, string>;
  readonly sizeTarget: number;
  readonly useZopfli?: boolean;
  readonly date?: Date;
}

/**
 * Build action which creates a zip archive.
 */
class CreateZip implements BuildAction {
  readonly params: ZipParameters;
  constructor(params: ZipParameters) {
    this.params = params;
  }
  get name(): string {
    return `Zip ${this.params.output}`;
  }
  get inputs(): readonly string[] {
    return [...this.params.files.values()];
  }
  get outputs(): readonly string[] {
    return [this.params.output];
  }
  async execute(): Promise<boolean> {
    const { output, files, sizeTarget } = this.params;
    let size: number;
    if (this.params.useZopfli) {
      size = await makeZopfliZip(output, files, this.params);
    } else {
      size = await runInfoZip(output, files);
    }
    const percentSize = ((100 * size) / sizeTarget).toFixed(2);
    const withinTarget =
      size <= sizeTarget ? chalk.green('yes') : chalk.red.bold('NO');
    process.stderr.write(
      `Zip file size: ${size} (${percentSize}% of target)\n` +
        `Within size limit: ${withinTarget}\n`,
    );
    return true;
  }
}

/** Create a build action that creates a zip archive. */
export function createZip(ctx: BuildContext, params: ZipParameters) {
  ctx.addAction(new CreateZip(params));
}
