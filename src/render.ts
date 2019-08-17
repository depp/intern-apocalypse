/**
 * Game renderer.
 */

import { gl } from './global';
import { compileShader, compileProgram } from './shader';

const vshader = compileShader(
  gl.VERTEX_SHADER,
  `
attribute vec2 pos;
void main() {
    gl_Position = vec4(pos, 0.0, 1.0);
}
`,
);

const fshader = compileShader(
  gl.FRAGMENT_SHADER,
  `
void main() {
    gl_FragColor = vec4(1.0);
}
`,
);

const prog = compileProgram(['pos'], vshader, fshader);

const buf = gl.createBuffer()!; // FIXME: check?

/**
 * Render the game.
 *
 * @param curTimeMS Current time in milliseconds.
 */
export function render(curTimeMS: number): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-0.8, -0.8, 0.8, -0.8, 0.0, 0.8]),
    gl.STATIC_DRAW,
  );

  const t = curTimeMS * 1e-3;
  gl.clearColor(Math.sin(t), 0.6, Math.cos(t), 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(prog);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
