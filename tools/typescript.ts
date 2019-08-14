/**
 * Build rules for compiling TypeScript code.
 * @module tools/typescript
 */

import * as fs from 'fs';

import * as ts from 'typescript';

import * as util from './util';

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

/** Compile the TypeScript code to JavaScript. */
export function compileTS() {
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
