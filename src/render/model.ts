/**
 * Model renderer.
 */

import { cameraMatrix } from '../game/camera';
import { gl } from '../lib/global';
import { modelInstances } from '../game/entity';
import { modelShader, ModelAttrib } from './shaders';
import { models } from '../model/model';
import { GenModel } from '../model/genmodel';
import * as genmodel from '../model/genmodel';
import { Matrix, identityMatrix } from '../lib/matrix';
import { levelModel } from './level';

/**
 * Render all models in the level.
 */
export function renderModels(): void {
  const p = modelShader;
  if (!p.program) {
    return;
  }

  function drawModel(model: GenModel, transform: Matrix): void {
    // Indexes and attributes
    genmodel.bind3D(
      model,
      ModelAttrib.Pos,
      ModelAttrib.Color,
      -1,
      ModelAttrib.Normal,
    );

    // Uniforms
    gl.uniformMatrix4fv(p.Model, false, transform);

    // Draw
    gl.drawElements(gl.TRIANGLES, model.icount, gl.UNSIGNED_SHORT, 0);
  }

  gl.useProgram(p.program);

  // Attributes
  genmodel.enableAttr(ModelAttrib.Pos, ModelAttrib.Color, ModelAttrib.Normal);

  // Common uniforms
  gl.uniformMatrix4fv(p.ViewProjection, false, cameraMatrix);

  drawModel(levelModel, identityMatrix);
  for (const instance of modelInstances) {
    const model = models[instance.model];
    if (model) {
      drawModel(model.mesh, instance.transform);
    }
  }

  // Cleanup
  genmodel.disableAttr(ModelAttrib.Pos, ModelAttrib.Color, ModelAttrib.Normal);
}
