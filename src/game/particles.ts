/**
 * Particle effects instances in the game.
 */

import { frameDT } from './time';
import { Matrix, matrixNew } from '../lib/matrix';
import {
  particlesInstances,
  entities,
  ParticlesInstance,
  Entity,
} from './entity';
import { ModelAsset } from '../model/models';

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
