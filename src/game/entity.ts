import { Vector, distanceSquared } from '../lib/math';
import { ModelAsset } from '../model/models';
import { Matrix } from '../lib/matrix';
import { DebugColor } from '../debug/debug';

/** Base interface for all entity types. */
export interface EntityBase {
  isDead?: boolean;
}

/** A game entity, which is rendered as a normal model. */
export interface ModelInstance extends EntityBase {
  /** The model asset to draw. */
  model: ModelAsset;
  /** Model transformation matrix. */
  transform: Matrix;
}

/** All model instances in the level. */
export const modelInstances: ModelInstance[] = [];

/** Parameters for particle effects. */
export interface ParticlesParameters {
  /** Time at which particles start disappearing. */
  timeFull: number;
  /** Time at which all particles have disappeared. */
  timeGone: number;
  /** Delay before all particles start moving. */
  timeDelay: number;
  /** Acceleration by gravity, meters per second squared, divided by two. */
  gravity: number;
  /** Colors that the particles change to (two vec3). */
  colors: number[];
  /** Rate at which colors change. */
  colorRate: number;
  /** Initial particle count. */
  count: number;
}

/** A game entity, which is rendered as a particle effect instance. */
export interface ParticlesInstance extends EntityBase {
  /** The model asset to use for the particle template. */
  model: ModelAsset;
  /** Particle effect parameters. */
  parameters: ParticlesParameters;
  /** Model transformation matrix. */
  transform: Matrix;
  /** Particle effect animation time. */
  time: number;
  /** Particle movement initial velocity and dispersion (two vec3). */
  velocity: number[];
}

/** All particles instances in the level. */
export const particlesInstances: ParticlesInstance[] = [];

/** A game entity, which other objects can collide with. */
export interface Collider extends EntityBase {
  /** The entity position. */
  pos: Readonly<Vector>;
  /** The entity collision radius. */
  radius: number;
  /** If true, the entity has a "smell" which attracts monsters. */
  smell?: boolean;

  /**
   * Damage this entity.
   * @param direction The direction from the attack to this entity.
   */
  damage(direction: Vector): void;

  /** Arrow for debugging view. */
  debugArrow?: Vector;
}

/** The location which attracts the monsters. */
export let monsterTarget: Readonly<Vector> | null | undefined;

/** List of all colliders in the world. */
export const colliders: Collider[] = [];

/** Find all colliders which touch the given circle. */
export function findColliders(center: Vector, radius: number): Collider[] {
  const result: Collider[] = [];
  for (const entity of colliders) {
    if (distanceSquared(center, entity.pos) <= (radius + entity.radius) ** 2) {
      result.push(entity);
    }
  }
  return result;
}

/** A game entity, which gets processed every tick. */
export interface Entity extends EntityBase {
  /** Update the entity. Called every frame. */
  update(): void;
}

/** List of all active entities in the world. */
export const entities: Entity[] = [];

/** Remove dead entities from a list. */
function clearDead<T extends EntityBase>(list: T[]): void {
  let i = 0;
  let j = 0;
  while (i < list.length) {
    const obj = list[i++];
    if (!obj.isDead) {
      list[j++] = obj;
    }
  }
  list.length = j;
}

/** Update all enteties. */
export function updateEntities(): void {
  for (const entity of entities) {
    entity.update();
  }
  clearDead(colliders);
  clearDead(entities);
  clearDead(modelInstances);
  clearDead(particlesInstances);
  let target: Readonly<Vector> | undefined;
  for (const entity of colliders) {
    if (entity.smell) {
      target = entity.pos;
    }
  }
  monsterTarget = target;
}

/** A marker for the debug map. */
export interface DebugMark {
  /** Time remaining before mark disappears. */
  time: number;
  /** Position of mark. */
  pos: Readonly<Vector>;
  /** Radius of mark. */
  radius: number;
  /** Color to draw mark with. */
  color: DebugColor;
}

/** List of all debug marks in the level. */
export const debugMarks: DebugMark[] = [];
