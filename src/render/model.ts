/**
 * Model renderer.
 */

import { cameraMatrix } from '../game/camera';
import { gl } from '../lib/global';
import { modelInstances } from '../game/model';
import { model as modelShader } from './shaders';
import { models } from '../model/models';

/**
 * Render all models in the level.
 */
export function renderModels(): void {
  const p = modelShader;
  if (!p.program) {
    return;
  }

  // State
  gl.useProgram(p.program);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  for (const instance of modelInstances) {
    const model = models[instance.model];
    if (!model) {
      continue;
    }

    // Indexes
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.index);

    // Attributes
    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, model.pos);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, model.color);
    gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 0, 0);

    gl.enableVertexAttribArray(2);
    gl.bindBuffer(gl.ARRAY_BUFFER, model.normal);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

    // Uniforms
    gl.uniformMatrix4fv(p.ViewProjection, false, cameraMatrix);
    gl.uniformMatrix4fv(p.Model, false, instance.transform);

    // Draw
    gl.drawElements(gl.TRIANGLES, model.count, gl.UNSIGNED_SHORT, 0);
  }

  // Cleanup
  gl.disableVertexAttribArray(0);
  gl.disableVertexAttribArray(1);
  gl.disableVertexAttribArray(2);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.DEPTH_TEST);
}
