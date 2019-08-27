/**
 * Generate shader loading code.
 */

import * as path from 'path';

import { loadShaders, listDeclarations } from './shader.syntax';
import { readPrograms, programSources } from './shader.programs';
import { emitLoader } from './shader.emit';

const dirname = 'shader';

async function main(): Promise<void> {
  try {
    const programs = await readPrograms(path.join(dirname, 'programs.json'));
    const sources = programSources(programs);
    const shaders = await loadShaders(dirname, sources);
    const out = emitLoader(programs, shaders);
    process.stdout.write(out);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
