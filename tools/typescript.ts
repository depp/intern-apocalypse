/**
 * Build rules for compiling TypeScript code.
 * @module tools/typescript
 */

import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { BuildContext, recursive } from './action';
import { projectRoot, pathWithExt } from './util';

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

const configPath = 'src/tsconfig.json';
const tsRoots = ['src/main.ts'];

/** The result of running the CompileTS build step. */
export interface CompileTSResult {
  /** List of paths to output JavaScript modules. */
  readonly jsModules: ReadonlyArray<string>;
}

/**
 * Build step which compiles TypeScript to JavaScript.
 */
export class CompileTS {
  createActions(ctx: BuildContext): CompileTSResult {
    const sources = ctx.listFilesWithExtensions('src', ['.ts'], recursive);
    const jsModules = sources.map(src =>
      path.join('build', pathWithExt(src, '.js')),
    );

    ctx.addAction({
      name: 'CompileTS',
      inputs: [configPath, ...sources],
      outputs: jsModules,
      execute: async () => this.compileTS(),
    });

    return { jsModules };
  }

  /** Read the TypeScript compiler options. */
  private readTSConfig(): ts.CompilerOptions {
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
      projectRoot,
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
  private compileTS() {
    const options = this.readTSConfig();
    const program = ts.createProgram(tsRoots, options);
    const emitResult = program.emit();
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics);
    if (diagnostics.length) {
      logTSDiagnostics(diagnostics);
      throw new Error('TypeScript compilation failed');
    }
  }
}
