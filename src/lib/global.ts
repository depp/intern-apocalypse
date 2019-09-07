/**
 * Common global variables.
 * @module src/global
 */

import { isDebug, isCompetition } from '../debug/debug';

/** All data bundled with the release builds of the game. */
export let bundledData!: string[];

/** Load the game data. */
export async function loadBundledData(): Promise<void> {
  if (isCompetition) {
    // For the competition build, we embed the data in a script tag.
    bundledData = JSON.parse(
      (document.getElementById('d') as HTMLScriptElement).text,
    );
    return;
  }
  if (isDebug) {
    // For debug builds, we load data over the web socket.
    return;
  }
  // For release builds, the data is bundled as a separate JSON file.
  const response = await fetch(new Request('data.json'));
  const data = await response.json();
  if (!Array.isArray(data) || data.some(x => typeof x != 'string')) {
    throw new Error('unexpected data');
  }
  bundledData = data;
}

/** Game canvas element. */
export const canvas = document.getElementById('g') as HTMLCanvasElement;

/** WebGL rendering context. */
export let gl!: WebGLRenderingContext;

export function startGL(): void {
  gl = canvas.getContext('webgl', {
    'alpha': false,
    'antialias': false,
  })!;
  if (!gl) {
    throw new Error('No WebGL.');
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
}
