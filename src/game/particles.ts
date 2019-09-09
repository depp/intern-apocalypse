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
  ParticlesParameters,
} from './entity';
import { ModelAsset } from '../model/models';
import { Vector } from '../lib/math';

/** Update a simple particles instance. */
function particleUpdate(this: ParticlesInstance & Entity): void {
  this.time += frameDT;
  if (this.time > this.parameters.timeGone) {
    this.isDead = true;
  }
}

/** Particle parameters for death animations. */
const deathParameters: ParticlesParameters = {
  timeFull: 0,
  timeGone: 1.0,
  timeDelay: 0.5,
  gravity: 2,
  colors: [1, 0, 0, 0, 0, 0],
  colorRate: 4,
  count: 1024,
};

/**
 * Spawn a particle effect system for an actor dying.
 * @param transform The initial transform of the particle effects.
 * @param model The particle effects model.
 */
export function spawnDeath(transform: Matrix, model: ModelAsset): void {
  transform = matrixNew(transform);
  const particles: ParticlesInstance & Entity = {
    model,
    parameters: deathParameters,
    transform,
    time: 0,
    velocity: [0, 0, 2, 1, 1, 1],
    update: particleUpdate,
  };
  particlesInstances.push(particles);
  entities.push(particles);
}

/** Particle parameters for a sword slash. */
const slashParameters: ParticlesParameters = {
  timeFull: 0,
  timeGone: 0.3,
  timeDelay: 0.1,
  gravity: 0,
  colors: [0.5, 0, 0, 0, 0, 0],
  colorRate: 4,
  count: 200,
};

/**
 * Spawn a sword slash particle effect.
 * @param pos Location of the target.
 * @param direction Direction the attack was going towards.
 */
export function spawnSlash(pos: Vector, direction: Vector): void {
  const transform = matrixNew();
  setIdentityMatrix(transform);
  translateMatrix(transform, [pos.x, pos.y]);
  rotateMatrixFromDirection(transform, Axis.Z, direction.x, direction.y);

  const particles: ParticlesInstance & Entity = {
    model: ModelAsset.Slash,
    parameters: slashParameters,
    transform,
    time: 0,
    velocity: [0.5, 0, 0, 1, 5, 1],
    update: particleUpdate,
  };
  particlesInstances.push(particles);
  entities.push(particles);
}
