/**
 * Particle effects renderer.
 */

import { cameraMatrix } from '../game/camera';
import { gl } from '../lib/global';
import { particlesInstances } from '../game/entity';
import { particlesShader, ParticlesAttrib } from './shaders';
import { models } from '../model/model';
import { randomVec4 } from './util';
import { AssertionError } from '../debug/debug';
import * as genmodel from '../model/genmodel';

/** Render models that are rendered in point cloud mode. */
export function renderParticles(): void {
  const p = particlesShader;
  if (!p.program || 1) {
    return;
  }

  if (randomVec4 == null) {
    throw new AssertionError('randomVec4 == null');
  }

  gl.useProgram(p.program);

  // Attributes
  genmodel.enableAttr(
    ParticlesAttrib.Pos,
    ParticlesAttrib.Color,
    ParticlesAttrib.Random,
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, randomVec4);
  gl.vertexAttribPointer(ParticlesAttrib.Random, 4, gl.FLOAT, false, 0, 0);

  // Common uniforms
  gl.uniformMatrix4fv(p.ViewProjection, false, cameraMatrix);

  for (const instance of particlesInstances) {
    const model = models[instance.model];
    if (!model) {
      continue;
    }

    const { particles } = model;
    const param = instance.parameters;
    let count = param.count;
    if (instance.time > param.timeFull) {
      if (instance.time > param.timeGone) {
        continue;
      }
      count =
        ((count * (param.timeGone - instance.time)) /
          (param.timeGone - param.timeFull)) |
        0;
    }
    if (!count) {
      continue;
    }

    // Attributes
    genmodel.bind3D(
      particles,
      ParticlesAttrib.Pos,
      ParticlesAttrib.Color,
      -1,
      -1,
    );

    // Uniforms
    gl.uniformMatrix4fv(p.Model, false, instance.transform);
    gl.uniform1f(p.Time, instance.time);
    gl.uniform1f(p.TimeDelay, param.timeDelay);
    gl.uniform1f(p.ColorRate, param.colorRate);
    gl.uniform1f(p.Gravity, param.gravity);
    gl.uniform3fv(p.Colors, param.colors);
    gl.uniform3fv(p.Velocity, instance.velocity);

    // Draw
    gl.drawArrays(gl.POINTS, 0, count);
  }

  // Cleanup
  genmodel.disableAttr(
    ParticlesAttrib.Pos,
    ParticlesAttrib.Color,
    ParticlesAttrib.Random,
  );
}
