import {
  Vector,
  scaleVector,
  lengthSquared,
  canonicalAngle,
  angleVector,
  zeroVector,
  distance,
  lerp,
} from '../lib/math';
import {
  Matrix,
  matrixNew,
  setIdentityMatrix,
  translateMatrix,
  rotateMatrixFromAngle,
  Axis,
} from '../lib/matrix';
import { clamp } from '../lib/util';
import { frameDT } from './time';
import { Collider } from './physics';

/** Parameters for a walker. */
export interface WalkerParameters {
  /** Walking speed, in meters per second. */
  readonly speed: number;

  /** Acceleration, in meters per second squared. */
  readonly acceleration: number;

  /** Turning speed, in radians per second. */
  readonly turnSpeed: number;
}

/** An object which can walk around the level. */
export interface Walker {
  /** The direction the walker is facing. */
  facing: Vector;

  /** The transformation matrix. Updated by update(). */
  transform: Matrix;

  /**
   * Update the walker position.
   * @param params Walking parameters.
   * @param movement The amount of movement to apply relative to the walker's
   * speed, a vector with magnitude no larger than one.
   */
  update(params: WalkerParameters, movement: Vector): void;
}

/**
 * Create a walker. This is not a complete entity by itself, but is a component
 * which manages the movement of an entity.
 */
export function createWalker(entity: Collider): Walker {
  const transform = matrixNew();
  let angle = 0;
  return {
    facing: angleVector(angle),
    transform,

    update(params: WalkerParameters, movement: Vector): void {
      // Calculate the new velocity.
      let { velocity } = entity;
      const targetVelocity = scaleVector(movement, params.speed);
      const maxDeltaVelocity = params.acceleration * frameDT;
      const deltaVelocity = distance(velocity, targetVelocity);
      if (deltaVelocity <= maxDeltaVelocity) {
        velocity = targetVelocity;
      } else {
        velocity = lerp(
          velocity,
          targetVelocity,
          maxDeltaVelocity / deltaVelocity,
        );
      }
      entity.velocity = velocity;

      // Calculate the new facing angle.
      if (lengthSquared(velocity)) {
        const targetAngle = Math.atan2(velocity.y, velocity.x);
        let deltaAngle = canonicalAngle(targetAngle - angle);
        const turnAmount = params.turnSpeed * frameDT;
        deltaAngle = clamp(deltaAngle, -turnAmount, turnAmount);
        angle = canonicalAngle(angle + deltaAngle);
        this.facing = angleVector(angle);
      }

      // Set the model transform.
      setIdentityMatrix(transform);
      translateMatrix(transform, [entity.pos.x, entity.pos.y]);
      rotateMatrixFromAngle(transform, Axis.Z, angle);
    },
  };
}
