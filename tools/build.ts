/**
 * Main build script.
 * @module tools/build
 */

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import chalk from 'chalk';
import * as Handlebars from 'handlebars';
import * as ts from 'typescript';

import * as util from './util';

/** Competition zip file size limit. */
const sizeTarget = 13 * 1024;

/** Print TypeScript diagnostic messages. */
function logTSDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
  const formatHost: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: path => path,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
  };
  process.stderr.write(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost),
  );
}

/** Read the TypeScript compiler options. */
function readTSConfig(): ts.CompilerOptions {
  const configPath = 'src/tsconfig.json';
  const { config, error } = ts.readConfigFile(configPath, path =>
    fs.readFileSync(path, 'utf8'),
  );
  if (error != null) {
    logTSDiagnostics([error]);
    throw new Error('Could not read TypeScript configuration');
  }
  const { compilerOptions } = config;
  const { options, errors } = ts.convertCompilerOptionsFromJson(
    compilerOptions,
    util.projectRoot,
    configPath,
  );
  if (errors.length) {
    logTSDiagnostics(errors);
    throw new Error('Could not process TypeScript compiler options');
  }
  options.outDir = 'build/src';
  return options;
}

/** Build the JavaScript code. */
function buildCode() {
  const options = readTSConfig();
  const program = ts.createProgram(['src/main.ts'], options);
  const emitResult = program.emit();
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);
  if (diagnostics.length) {
    logTSDiagnostics(diagnostics);
    throw new Error('TypeScript compilation failed');
  }
}

/** Escape JavaScript for embedding in script tag. */
function inlineJavaScript(js: string): Handlebars.SafeString {
  return new Handlebars.SafeString(
    js.replace('</script', '<\\/script').replace('<!--', '<\\!--'),
  );
}

/** Build the game HTML page. */
async function buildHTML(): Promise<void> {
  const jsSrc = fs.promises.readFile('build/src/main.js', 'utf8');
  const templateSrc = fs.promises.readFile('src/index.html', 'utf8');
  const template = Handlebars.compile(await templateSrc);
  const html = template({
    title: 'Internship at the Apocalypse',
    script: inlineJavaScript(await jsSrc),
  });
  await fs.promises.writeFile('build/index.html', html, {
    encoding: 'utf8',
  });
}

/**
 * Create a zip file containing the given files.
 * @returns Size of the zip file, in bytes.
 */
async function createZip(
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

/** Build the packaged zip file. */
async function buildZip(): Promise<void> {
  const zipPath = 'build/InternApocalypse.zip';
  const size = await createZip(
    zipPath,
    new Map([['index.html', 'build/index.html']]),
  );
  const percentSize = ((100 * size) / sizeTarget).toFixed(2);
  const withinTarget =
    size <= sizeTarget ? chalk.green('yes') : chalk.red.bold('NO');
  process.stderr.write(
    `Zip file size: ${size} (${percentSize}% of target)\n` +
      `Within size limit: ${withinTarget}\n`,
  );
}

async function main() {
  try {
    process.chdir(util.projectRoot);
    await util.mkdir('build');
    await util.removeAll('build/tmp');
    await util.mkdir('build/tmp');
    buildCode();
    await buildHTML();
    await buildZip();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
