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
import { currentLevel } from '../game/campaign';

// prettier-ignore
const lightColor = new Float32Array([
  0.1, 0.2, 0.3,
  1.0, 0.8, 0.6,
])
// prettier-ignore
const lightPos = new Float32Array([
  0.0, 0.0, 1.0,
  -0.6, -0.6, 0.6,
])

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
  gl.uniform3fv(p.LightColor, lightColor);
  gl.uniform3fv(p.LightPos, lightPos);

  drawModel(currentLevel.levelModel, identityMatrix);
  for (const instance of modelInstances) {
    if (!instance.hidden) {
      const model = models[instance.model];
      if (model) {
        drawModel(model.mesh, instance.transform);
      }
    }
  }

  // Cleanup
  genmodel.disableAttr(ModelAttrib.Pos, ModelAttrib.Color, ModelAttrib.Normal);
}
