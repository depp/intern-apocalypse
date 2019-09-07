import {
  Vector,
  scaleVector,
  lengthSquared,
  canonicalAngle,
} from '../lib/math';
import {
  Matrix,
  matrixNew,
  setIdentityMatrix,
  translateMatrix,
  rotateMatrixFromAngle,
  Axis,
  rotateMatrixFromDirection,
} from '../lib/matrix';
import { walk } from './walk';
import { clamp } from '../lib/util';
import { frameDT } from './time';

/** Parameters for a walker. */
interface WalkerParameters {
  /** Walking speed, in meters per second. */
  readonly speed: number;

  /** Turning speed, in radians per second. */
  readonly turnSpeed: number;
}

/** An object which can walk around the level. */
export interface Walker {
  /** The current position. Updated by update(). */
  pos: Readonly<Vector>;

  /** The transformation matrix. Updated by update(). */
  transform: Matrix;

  /**
   * Update the walker position.
   * @param params Walking parameters.
   * @param movement The amount of movement to apply relative to the walker's
   * speed, a vector with magnitude no larger than one.
   */
  update(params: WalkerParameters, movement: Readonly<Vector>): void;
}

/**
 * Create a walker. This is not a complete entity by itself, but is a component
 * which manages the movement of an entity.
 */
export function createWalker(pos: Vector): Walker {
  const transform = matrixNew();
  let angle = 0;
  return {
    pos,
    transform,
    update(params: WalkerParameters, movement: Readonly<Vector>): void {
      // Calculate the new position.
      this.pos = walk(this.pos, scaleVector(movement, params.speed * frameDT));
      if (lengthSquared(movement)) {
        const targetAngle = Math.atan2(movement.y, movement.x);
        let deltaAngle = canonicalAngle(targetAngle - angle);
        const turnAmount = params.turnSpeed * frameDT;
        deltaAngle = clamp(deltaAngle, -turnAmount, turnAmount);
        angle = canonicalAngle(angle + deltaAngle);
      }

      // Set the model transform.
      setIdentityMatrix(transform);
      translateMatrix(transform, [this.pos.x, this.pos.y]);
      rotateMatrixFromAngle(transform, Axis.Z, angle + 0.5 * Math.PI);
      rotateMatrixFromDirection(transform, Axis.X, 0, 1);
    },
  };
}
