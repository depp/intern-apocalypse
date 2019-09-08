/**
 * Particle effects instances in the game.
 */

import { frameDT } from './time';
import {
  Matrix,
  matrixNew,
  setIdentityMatrix,
  translateMatrix,
  rotateMatrixFromDirection,
  Axis,
} from '../lib/matrix';
import {
  particlesInstances,
  entities,
  ParticlesInstance,
  Entity,
} from './entity';
import { ModelAsset } from '../model/models';
import { Vector } from '../lib/math';

/**
 * Spawn a particle effect system.
 * @param transform The initial transform of the particle effects.
 * @param model The particle effects model.
 */
export function spawnParticles(transform: Matrix, model: ModelAsset): void {
  transform = matrixNew(transform);
  const particles: ParticlesInstance & Entity = {
    model,
    transform,
    time: 0,
    update() {
      this.time += frameDT;
      if (this.time > 3.0) {
        this.isDead = true;
      }
    },
  };
  particlesInstances.push(particles);
  entities.push(particles);
}

/**
 * Spawn a sword slash particle effect.
 * @param pos Location of the target.
 * @param direction Direction the attack was going towards.
 */
export function spawnSlash(
  pos: Readonly<Vector>,
  direction: Readonly<Vector>,
): void {
  const transform = matrixNew();
  setIdentityMatrix(transform);
  translateMatrix(transform, [pos.x, pos.y]);
  rotateMatrixFromDirection(transform, Axis.Z, direction.y, -direction.x);
  rotateMatrixFromDirection(transform, Axis.X, 0, 1);
  spawnParticles(transform, ModelAsset.Slash);
}
