/**
 * Build rules for compiling TypeScript code.
 * @module tools/typescript
 */

import * as fs from 'fs';

import * as ts from 'typescript';

import { BuildContext, recursive, BuildAction } from './action';
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

/** Parameters for compiling TypeScript. */
export interface CompileTSParameters {
  /** Path to the directory to store the outputs. */
  readonly outDir: string;
  /** Input file paths. */
  readonly inputs: readonly string[];
  /** Path to configuration file. */
  readonly config: string;
  /** Entry point file paths. */
  readonly rootNames: readonly string[];
}

/**
 * Build action which compiles TypeScript to JavaScript.
 */
class CompileTS implements BuildAction {
  private readonly params: CompileTSParameters;
  constructor(params: CompileTSParameters) {
    this.params = params;
  }
  get name(): string {
    return `CompileTS ${this.params.outDir}`;
  }
  get inputs(): readonly string[] {
    return this.params.inputs;
  }
  get outputs(): readonly string[] {
    return this.params.inputs.map(src => 'build/' + pathWithExt(src, '.js'));
  }

  /** Read the TypeScript compiler options. */
  private readTSConfig(): ts.CompilerOptions {
    const { params } = this;
    const { config, error } = ts.readConfigFile(params.config, path =>
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
      params.config,
    );
    if (errors.length) {
      logTSDiagnostics(errors);
      throw new Error('Could not process TypeScript compiler options');
    }
    options.rootDir = '.';
    options.outDir = 'build';
    return options;
  }

  /** Compile the TypeScript code to JavaScript. */
  execute(): Promise<void> {
    const { params } = this;
    const options = this.readTSConfig();
    const host = ts.createCompilerHost(options);
    // Fixme: use old program.
    const program = ts.createProgram(params.rootNames, options, host);
    const emitResult = program.emit();
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics);
    if (diagnostics.length) {
      logTSDiagnostics(diagnostics);
      throw new Error('TypeScript compilation failed');
    }
    return Promise.resolve();
  }
}

/**
 * Create build actions to compile TypeScript code.
 */
export function compileTS(
  ctx: BuildContext,
  params: CompileTSParameters,
): void {
  ctx.addAction(new CompileTS(params));
}
