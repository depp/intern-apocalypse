/**
 * Model renderer.
 */

import { cameraMatrix } from './camera';
import { gl } from './global';
import { identityMatrix, translationMatrix } from './matrix';
import { playerPos } from './player';
import { compileShader, compileProgram } from './shader';

const vshader = compileShader(
  gl.VERTEX_SHADER,
  `
attribute vec3 aVertexPos;
attribute vec4 aVertexColor;
varying vec4 Color;
uniform mat4 ViewProjection;
uniform mat4 Model;
void main() {
    Color = aVertexColor;
    gl_Position = ViewProjection * Model * vec4(aVertexPos * 0.5, 1.0);
}
  `,
);

const fshader = compileShader(
  gl.FRAGMENT_SHADER,
  `
precision lowp float;
varying vec4 Color;
void main() {
    gl_FragColor = Color;
}
  `,
);

const prog = compileProgram(['Pos'], vshader, fshader);

const indexBuf = gl.createBuffer()!; // FIXME: check?
const posBuf = gl.createBuffer()!;
const colorBuf = gl.createBuffer()!;

function createCube() {
  // Element indexes.
  const index = new Uint16Array(6 * 6);
  for (let i = 0; i < 6; i++) {
    index.set([0, 1, 2, 2, 1, 3].map(x => x + i * 4), i * 6);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);

  // Position attribute.
  // prettier-ignore
  const pos = new Float32Array([
    // +x
    1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1,
    // -x
    0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1,
    // +y
    1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1,
    // -y
    0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1,
    // +z
    0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1,
    // -z
    1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0,
  ]);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);

  // Color attribute.
  // prettier-ignore
  const color = new Uint8Array([
    // +x
    255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0,
    // -x
    0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0,
    // +y
    0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0,
    // -y
    255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0,
    // +z
    0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0,
    // -z
    255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0,
  ]);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
  gl.bufferData(gl.ARRAY_BUFFER, color, gl.STATIC_DRAW);
}

createCube();

/** The model transformation matrix. */
const modelMatrix = new Float32Array(16);

/**
 * Render all models in the level.
 */
export function renderModels(): void {
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
  gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 0, 0);

  const vp = gl.getUniformLocation(prog, 'ViewProjection');
  const m = gl.getUniformLocation(prog, 'Model');

  translationMatrix(modelMatrix, [playerPos.x, playerPos.y]);

  gl.useProgram(prog);
  gl.enable(gl.CULL_FACE);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.uniformMatrix4fv(vp, false, cameraMatrix);
  gl.uniformMatrix4fv(m, false, modelMatrix);
  gl.drawElements(gl.TRIANGLES, 6 * 6, gl.UNSIGNED_SHORT, 0);
}
