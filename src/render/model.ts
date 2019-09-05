/**
 * Model renderer.
 */

import { cameraMatrix } from '../game/camera';
import { gl } from '../lib/global';
import {
  translationMatrix,
  scaleMatrix,
  matrixMultiply,
  rotationMatrixFromAngle,
  Axis,
  identityMatrix,
} from '../lib/matrix';
import { playerPos } from '../game/player';
import { model as modelShader } from './shaders';
import { ModelAsset, models } from '../model/models';
import { frameDT } from '../game/time';

/** The model transformation matrix. */
const modelMatrix = new Float32Array(16);
const mulMatrix = new Float32Array(16);

let rot = 0;

/**
 * Render all models in the level.
 */
export function renderModels(): void {
  rot = (rot + frameDT * 0.25) % 1;
  const p = modelShader;
  if (!p.program) {
    return;
  }

  const m = models[ModelAsset.Person];
  if (!m) {
    return;
  }

  identityMatrix(modelMatrix);
  translationMatrix(modelMatrix, [playerPos.x, playerPos.y, 2.0]);
  rotationMatrixFromAngle(mulMatrix, Axis.Z, 2 * Math.PI * rot);
  matrixMultiply(modelMatrix, modelMatrix, mulMatrix);
  rotationMatrixFromAngle(mulMatrix, Axis.X, 4 * Math.PI * rot);
  matrixMultiply(modelMatrix, modelMatrix, mulMatrix);

  // State
  gl.useProgram(p.program);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  // Indexes
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.index);

  // Attributes
  gl.enableVertexAttribArray(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, m.pos);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  gl.enableVertexAttribArray(1);
  gl.bindBuffer(gl.ARRAY_BUFFER, m.color);
  gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 0, 0);

  gl.enableVertexAttribArray(2);
  gl.bindBuffer(gl.ARRAY_BUFFER, m.normal);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

  // Uniforms
  gl.uniformMatrix4fv(p.ViewProjection, false, cameraMatrix);
  gl.uniformMatrix4fv(p.Model, false, modelMatrix);

  // Draw
  gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);

  // Cleanup
  gl.disableVertexAttribArray(0);
  gl.disableVertexAttribArray(1);
  gl.disableVertexAttribArray(2);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.DEPTH_TEST);
}
