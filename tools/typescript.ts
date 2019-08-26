/**
 * Build rules for compiling TypeScript code.
 * @module tools/typescript
 */

import * as fs from 'fs';

import * as ts from 'typescript';

import { BuildContext, BuildAction } from './action';
import { projectRoot, pathWithExt } from './util';
import { Config, BuildArgs } from './config';

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

/** Transform by changing any top-level isDebug declarations to false. */
function setIsDebugFalse(): ts.TransformerFactory<ts.SourceFile> {
  return ctx => {
    return source =>
      ts.visitEachChild(
        source,
        node => {
          if (ts.isVariableStatement(node)) {
            for (const decl of node.declarationList.declarations) {
              if (decl.name.getText(source) == 'isDebug') {
                decl.initializer = ts.createFalse();
              }
            }
          }
          return node;
        },
        ctx,
      );
  };
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
    return this.params.inputs.flatMap(src => {
      const js = 'build/' + pathWithExt(src, '.js');
      return [js, js + '.map'];
    });
  }

  /** Read the TypeScript compiler options. */
  private readTSConfig(): ts.CompilerOptions | null {
    const { params } = this;
    const { config, error } = ts.readConfigFile(params.config, path =>
      fs.readFileSync(path, 'utf8'),
    );
    if (error != null) {
      logTSDiagnostics([error]);
      return null;
    }
    const { compilerOptions } = config;
    const { options, errors } = ts.convertCompilerOptionsFromJson(
      compilerOptions,
      projectRoot,
      params.config,
    );
    if (errors.length) {
      logTSDiagnostics(errors);
      return null;
    }
    options.rootDir = '.';
    options.outDir = 'build';
    options.sourceMap = true;
    options.sourceRoot = projectRoot;
    return options;
  }

  /** Compile the TypeScript code to JavaScript. */
  execute(config: Readonly<BuildArgs>): Promise<boolean> {
    const { params } = this;
    const options = this.readTSConfig();
    if (options == null) {
      return Promise.resolve(false);
    }
    const host = ts.createCompilerHost(options);
    // Fixme: use old program.
    const program = ts.createProgram(params.rootNames, options, host);
    const emitResult = program.emit(
      undefined,
      undefined,
      undefined,
      undefined,
      this.transformers(config),
    );
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics);
    if (diagnostics.length) {
      logTSDiagnostics(diagnostics);
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }

  /** Get the TypeScript transformers for this build configuration. */
  private transformers(config: Readonly<BuildArgs>): ts.CustomTransformers {
    if (config.config == Config.Debug) {
      return {};
    }
    return {
      before: [setIsDebugFalse()],
    };
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
