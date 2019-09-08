/**
 * Model renderer.
 */

import { cameraMatrix } from '../game/camera';
import { gl } from '../lib/global';
import { modelInstances } from '../game/entity';
import { model as modelShader, Attribute } from './shaders';
import { models } from '../model/model';

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

  for (const instance of modelInstances) {
    const model = models[instance.model];
    if (!model) {
      continue;
    }

    // Indexes
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.index);

    // Attributes
    gl.enableVertexAttribArray(Attribute.Pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, model.pos);
    gl.vertexAttribPointer(Attribute.Pos, 3, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(Attribute.Color);
    gl.bindBuffer(gl.ARRAY_BUFFER, model.color);
    gl.vertexAttribPointer(Attribute.Color, 4, gl.UNSIGNED_BYTE, true, 0, 0);

    gl.enableVertexAttribArray(Attribute.Normal);
    gl.bindBuffer(gl.ARRAY_BUFFER, model.normal);
    gl.vertexAttribPointer(Attribute.Normal, 3, gl.FLOAT, false, 0, 0);

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
}
