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

/** Render models that are rendered in point cloud mode. */
export function renderParticles(): void {
  const p = particlesShader;
  if (!p.program) {
    return;
  }

  if (randomVec4 == null) {
    throw new AssertionError('randomVec4 == null');
  }

  gl.useProgram(p.program);

  // Attributes
  gl.enableVertexAttribArray(ParticlesAttrib.Pos);
  gl.enableVertexAttribArray(ParticlesAttrib.Random);
  gl.enableVertexAttribArray(ParticlesAttrib.Color);

  gl.bindBuffer(gl.ARRAY_BUFFER, randomVec4);
  gl.vertexAttribPointer(ParticlesAttrib.Random, 4, gl.FLOAT, false, 0, 0);

  // Common uniforms
  gl.uniformMatrix4fv(p.ViewProjection, false, cameraMatrix);

  for (const instance of particlesInstances) {
    const model = models[instance.model];
    if (!model) {
      continue;
    }

    const points = model.points;

    // Attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, points.pos);
    gl.vertexAttribPointer(ParticlesAttrib.Pos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, points.color);
    gl.vertexAttribPointer(
      ParticlesAttrib.Color,
      4,
      gl.UNSIGNED_BYTE,
      true,
      0,
      0,
    );

    // Uniforms
    gl.uniformMatrix4fv(p.Model, false, instance.transform);
    gl.uniform1f(p.Time, instance.time);

    // Draw
    gl.drawArrays(gl.POINTS, 0, points.count);
  }

  // Cleanup
  gl.disableVertexAttribArray(ParticlesAttrib.Pos);
  gl.disableVertexAttribArray(ParticlesAttrib.Color);
}
