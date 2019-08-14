/**
 * Common global variables.
 * @module src/global
 */

/** Game canvas element. */
export const canvas = document.getElementById('g') as HTMLCanvasElement;
/** WebGL rendering context. */
export const gl = canvas.getContext('webgl', {
  alpha: false,
  antialias: false,
})!;

if (!gl) {
  throw new Error('Could not create WebGL context');
}
