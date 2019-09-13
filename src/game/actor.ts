import {
  Vector,
  zeroVector,
  scaleVector,
  distance,
  lerp,
  lengthSquared,
  canonicalAngle,
  angleVector,
} from '../lib/math';
import {
  Matrix,
  matrixNew,
  setIdentityMatrix,
  translateMatrix,
  rotateMatrixFromAngle,
  Axis,
} from '../lib/matrix';
import {
  Entity,
  entities,
  modelInstances,
  ModelInstance,
  Team,
} from './entity';
import { Collider, colliders } from './physics';
import { ModelAsset } from '../model/models';
import { frameDT } from './time';
import { clamp } from '../lib/util';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';
import { spawnDeath, spawnSlash } from './particles';
import { isDebug } from '../debug/debug';

/** Parameters for how an actor moves. */
export interface MovementParameters {
  /** Walking speed, in meters per second. */
  readonly speed: number;

  /** Acceleration, in meters per second squared. */
  readonly acceleration: number;

  /** Turning speed, in radians per second. */
  readonly turnSpeed: number;
}

/** Arguments for creating an actor. */
export interface ActorArgument {
  pos: Vector;
  angle: number;
  model: ModelAsset;
  radius: number;
  team: Team;
  health: number;
  actorUpdate: ActorCallback;
  actorDamaged: ActorCallback;
  actorDied: ActorCallback;
}

/**
 * Actor - beings that move about the level of their own accord, can take
 * damage, etc. Monsters and players included.
 */
export interface Actor extends ModelInstance, Collider, Entity {
  /** The direction the walker is facing. */
  facing: Vector;

  /** The transformation matrix. Updated by update(). */
  transform: Matrix;

  /** The amount of damage the actor can take before dying. */
  health: number;

  /**
   * Update the actor physics parameters.
   * @param params Walking parameters.
   * @param movement The amount of movement to apply relative to the walker's
   * speed, a vector with magnitude no larger than one.
   */
  actorMove(params: MovementParameters, movement: Vector): void;
}

/** Actor callback function. */
export type ActorCallback = (this: Actor) => void;

interface ActorImplementation extends Actor {
  /** Facing angle. */
  angle: number;

  /** Actor update callback. */
  actorUpdate(): void;

  /** Actor damaged callback. */
  actorDamaged(): void;

  /** Actor death callback. */
  actorDied(): void;
}

/** Spawn a new actor in the level. */
export function spawnActor(arg: ActorArgument): void {
  const actor: ActorImplementation = Object.assign(arg, {
    facing: zeroVector,
    transform: matrixNew(),
    velocity: zeroVector,
    actorMove(
      this: ActorImplementation,
      params: MovementParameters,
      movement: Vector,
    ): void {
      // Calculate the new velocity.
      let { velocity } = this;
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
      this.velocity = velocity;

      // Calculate the new facing angle.
      if (lengthSquared(velocity)) {
        const targetAngle = Math.atan2(velocity.y, velocity.x);
        let deltaAngle = canonicalAngle(targetAngle - this.angle);
        const turnAmount = params.turnSpeed * frameDT;
        deltaAngle = clamp(deltaAngle, -turnAmount, turnAmount);
        this.angle = canonicalAngle(this.angle + deltaAngle);
        this.facing = angleVector(this.angle);
      }
    },
    damage(this: ActorImplementation, direction: Vector): void {
      if (this.isDead) {
        return;
      }
      this.health--;
      spawnSlash(this.pos, direction);
      if (this.health > 0) {
        playSound(Sounds.MonsterHit);
        this.velocity = scaleVector(direction, 12);
        this.actorDamaged();
      } else {
        spawnDeath(this.transform, this.model);
        playSound(Sounds.MonsterDeath);
        this.isDead = true;
        this.actorDied();
      }
    },
    update(this: ActorImplementation): void {
      // Set the model transform.
      const { transform } = this;
      setIdentityMatrix(transform);
      translateMatrix(transform, [this.pos.x, this.pos.y]);
      rotateMatrixFromAngle(transform, Axis.Z, this.angle);
      // Update client afterwards, so they can use transform.
      this.actorUpdate();
      if (isDebug) {
        this.debugArrow = this.facing;
      }
    },
  });
  modelInstances.push(actor);
  entities.push(actor);
  colliders.push(actor);
}
