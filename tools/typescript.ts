/**
 * Build rules for compiling TypeScript code.
 * @module tools/typescript
 */

import * as fs from 'fs';
import * as path from 'path';

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

/**
 * Transform by changing isDebug in src/debug.ts to false.
 */
function setIsDebugFalse(): ts.TransformerFactory<ts.SourceFile> {
  const debugTS = path.join(projectRoot, 'src/debug.ts');
  return ctx => {
    return node => {
      if (node.fileName != debugTS) {
        return node;
      }
      return ts.visitEachChild(
        node,
        node => {
          if (ts.isVariableStatement(node)) {
            for (const decl of node.declarationList.declarations) {
              if (decl.name.getText() == 'isDebug') {
                decl.initializer = ts.createFalse();
              }
            }
          }
          return node;
        },
        ctx,
      );
    };
  };
}

/**
 * Return true if the statement throws an AssertionError and does nothing else.
 */
function isThrowAssertionError(node: ts.Statement): boolean {
  let sthrow: ts.ThrowStatement;
  if (ts.isBlock(node)) {
    if (node.statements.length != 1) {
      return false;
    }
    const child = node.statements[0];
    if (!ts.isThrowStatement(child)) {
      return false;
    }
    sthrow = child;
  } else if (ts.isThrowStatement(node)) {
    sthrow = node;
  } else {
    return false;
  }
  const oexpr = sthrow.expression;
  if (oexpr == null || !ts.isNewExpression(oexpr)) {
    return false;
  }
  const cexpr = oexpr.expression;
  return (
    cexpr != null &&
    ts.isIdentifier(cexpr) &&
    cexpr.getText() == 'AssertionError'
  );
}

/**
 * Transform by removing statements that 'throw AssertionError'.
 *
 * This looks for any if statement. If one of the branches of the if statement
 * throws AssertionError and does nothing else, then the if statement is
 * rewritten so that the other branch is taken. The if statement expression must
 * not have side effects.
 *
 * Example input:
 *
 *     if (x > 4) { throw new AssertionError('x > 4'); }
 *
 * Example output:
 *
 *     if (false) { throw new AssertionError('x > 4'); }
 */
function removeAssertions(): ts.TransformerFactory<ts.SourceFile> {
  return ctx => {
    const visit: ts.Visitor = node => {
      if (ts.isIfStatement(node)) {
        if (isThrowAssertionError(node.thenStatement)) {
          node.expression = ts.createFalse();
          return node;
        } else if (
          node.elseStatement &&
          isThrowAssertionError(node.elseStatement)
        ) {
          node.expression = ts.createTrue();
          return node;
        }
      }
      return ts.visitEachChild(node, visit, ctx);
    };
    return node => ts.visitNode(node, visit);
  };
}

/**
 * Convert all const variables to let.
 */
function constToLet(): ts.TransformerFactory<ts.SourceFile> {
  return ctx => {
    const visit: ts.Visitor = node => {
      if (ts.isVariableDeclarationList(node)) {
        if ((node.flags & ts.NodeFlags.Const) != 0) {
          node = ts.createVariableDeclarationList(
            node.declarations,
            (node.flags & ~ts.NodeFlags.Const) | ts.NodeFlags.Let,
          );
        }
      }
      return ts.visitEachChild(node, visit, ctx);
    };
    return node => ts.visitNode(node, visit);
  };
}

/**
 * Fix uniform references like 'levelShader.Model' => 'levelShader["x"]'.
 */
function fixUniforms(
  identMap: Map<string, string>,
  checker: ts.TypeChecker,
): ts.TransformerFactory<ts.SourceFile> {
  return ctx => {
    const visit: ts.Visitor = node => {
      if (ts.isPropertyAccessExpression(node)) {
        const text = node.name.getText();
        const subst = identMap.get(text);
        if (subst != null) {
          const lhs = node.expression;
          return ts.createElementAccess(lhs, ts.createStringLiteral(subst));
          // const symbol = checker.getSymbolAtLocation(lhs);
          // checker.getTypeOfSymbolAtLocation(symbol, lhs);
        }
      }
      return ts.visitEachChild(node, visit, ctx);
    };
    return node => ts.visitNode(node, visit);
  };
}

/**
 * Read the map that fixes uniform names.
 */
async function readUniformMap(): Promise<Map<string, string>> {
  const text = await fs.promises.readFile('build/uniforms.json', 'utf8');
  const data = JSON.parse(text);
  const map = new Map<string, string>();
  for (const key of Object.keys(data)) {
    map.set(key, data[key]);
  }
  return map;
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
  async execute(config: Readonly<BuildArgs>): Promise<boolean> {
    const { params } = this;
    const options = this.readTSConfig();
    if (options == null) {
      return Promise.resolve(false);
    }
    const host = ts.createCompilerHost(options);
    // Fixme: use old program.
    const program = ts.createProgram(params.rootNames, options, host);
    const checker = program.getTypeChecker();
    const emitResult = program.emit(
      undefined,
      undefined,
      undefined,
      undefined,
      await this.transformers(config, checker),
    );
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .concat(emitResult.diagnostics);
    if (diagnostics.length) {
      logTSDiagnostics(diagnostics);
      return Promise.resolve(false);
    }
    if (config.config == Config.Release) {
      const copies: [string, string][] = [
        ['build/shaders.js', 'build/src/render/shaders.js'],
        ['build/models.js', 'build/src/model/models.js'],
      ];
      await Promise.all(
        copies.map(async ([src, dest]) => {
          const bytes = await fs.promises.readFile(src);
          await fs.promises.writeFile(dest, bytes);
        }),
      );
    }
    return Promise.resolve(true);
  }

  /** Get the TypeScript transformers for this build configuration. */
  private async transformers(
    config: Readonly<BuildArgs>,
    checker: ts.TypeChecker,
  ): Promise<ts.CustomTransformers> {
    if (config.config == Config.Debug) {
      return {};
    }
    const uniformMap = await readUniformMap();
    return {
      before: [
        setIsDebugFalse(),
        removeAssertions(),
        constToLet(),
        fixUniforms(uniformMap, checker),
      ],
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
