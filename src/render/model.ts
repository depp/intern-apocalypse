/**
 * Model renderer.
 */

import { cameraMatrix } from '../game/camera';
import { gl } from '../lib/global';
import { modelInstances } from '../game/entity';
import { modelShader, ModelAttrib } from './shaders';
import { models } from '../model/model';

/**
 * Render all models in the level.
 */
export function renderModels(): void {
  const p = modelShader;
  if (!p.program) {
    return;
  }

  gl.useProgram(p.program);

  // Attributes
  gl.enableVertexAttribArray(ModelAttrib.Pos);
  gl.enableVertexAttribArray(ModelAttrib.Color);
  gl.enableVertexAttribArray(ModelAttrib.Normal);

  // Common uniforms
  gl.uniformMatrix4fv(p.ViewProjection, false, cameraMatrix);

  for (const instance of modelInstances) {
    const model = models[instance.model];
    if (!model) {
      continue;
    }

    // Indexes
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.index);

    // Attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, model.pos);
    gl.vertexAttribPointer(ModelAttrib.Pos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, model.color);
    gl.vertexAttribPointer(ModelAttrib.Color, 4, gl.UNSIGNED_BYTE, true, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, model.normal);
    gl.vertexAttribPointer(ModelAttrib.Normal, 3, gl.FLOAT, false, 0, 0);

    // Uniforms
    gl.uniformMatrix4fv(p.Model, false, instance.transform);

    // Draw
    gl.drawElements(gl.TRIANGLES, model.count, gl.UNSIGNED_SHORT, 0);
  }

  // Cleanup
  gl.disableVertexAttribArray(ModelAttrib.Pos);
  gl.disableVertexAttribArray(ModelAttrib.Color);
  gl.disableVertexAttribArray(ModelAttrib.Normal);
}
