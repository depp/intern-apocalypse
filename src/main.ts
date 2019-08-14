/** Game canvas element. */
const canvas = document.getElementById('g') as HTMLCanvasElement;
/** WebGL rendering context. */
const gl = canvas.getContext('webgl', { alpha: false });

if (!gl) {
  throw new Error('Could not create WebGL context');
}

gl.clearColor(0, 0.6, 0.9, 0);
gl.clear(gl.COLOR_BUFFER_BIT);
