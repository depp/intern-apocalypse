/**
 * Model renderer.
 */

import { cameraMatrix } from './camera';
import { gl } from './global';
import { translationMatrix } from './matrix';
import { playerPos } from './player';
import { model as modelShader } from './shaders';

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
  const p = modelShader;
  if (!p.program) {
    return;
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
  gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 0, 0);

  translationMatrix(modelMatrix, [playerPos.x, playerPos.y]);

  gl.useProgram(p.program);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.uniformMatrix4fv(p.ViewProjection, false, cameraMatrix);
  gl.uniformMatrix4fv(p.Model, false, modelMatrix);
  gl.drawElements(gl.TRIANGLES, 6 * 6, gl.UNSIGNED_SHORT, 0);
}
