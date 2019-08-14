import * as fs from 'fs';
import * as path from 'path';

import * as Handlebars from 'handlebars';
import * as ts from 'typescript';

/** Path to root directory containing the project. */
const projectRoot = path.dirname(__dirname);

/** Escape JavaScript for embedding in script tag. */
function inlineJavaScript(js: string): Handlebars.SafeString {
  return new Handlebars.SafeString(
    js.replace('</script', '<\\/script').replace('<!--', '<\\!--'),
  );
}

/** Create a directory if it does not already exist. */
async function mkdir(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath);
  } catch (e) {
    if (e.code != 'EEXIST') {
      throw e;
    }
  }
}

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

async function main() {
  process.chdir(projectRoot);
  await mkdir('build');
  buildCode();
  await buildHTML();
}

main();
