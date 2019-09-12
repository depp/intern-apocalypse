/**
 * Model renderer.
 */

import { cameraMatrix } from '../game/camera';
import { gl } from '../lib/global';
import { modelInstances } from '../game/entity';
import { modelShader, ModelAttrib } from './shaders';
import { models } from '../model/model';
import * as genmodel from '../model/genmodel';

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
  genmodel.enableAttr(ModelAttrib.Pos, ModelAttrib.Color, ModelAttrib.Normal);

  // Common uniforms
  gl.uniformMatrix4fv(p.ViewProjection, false, cameraMatrix);

  for (const instance of modelInstances) {
    const model = models[instance.model];
    if (!model) {
      continue;
    }
    const { mesh } = model;

    // Indexes and attributes
    genmodel.bind3D(
      mesh,
      ModelAttrib.Pos,
      ModelAttrib.Color,
      -1,
      ModelAttrib.Normal,
    );

    // Uniforms
    gl.uniformMatrix4fv(p.Model, false, instance.transform);

    // Draw
    gl.drawElements(gl.TRIANGLES, mesh.icount, gl.UNSIGNED_SHORT, 0);
  }

  // Cleanup
  genmodel.disableAttr(ModelAttrib.Pos, ModelAttrib.Color, ModelAttrib.Normal);
}
