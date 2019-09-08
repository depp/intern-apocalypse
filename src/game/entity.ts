import { Vector, distanceSquared } from '../lib/math';
import { ModelAsset } from '../model/models';
import { Matrix } from '../lib/matrix';

/** Base interface for all entity types. */
export interface EntityBase {
  isDead?: boolean;
}

/** A game entity, which is rendered. */
export interface ModelInstance extends EntityBase {
  /** The model asset to draw. */
  model: ModelAsset;
  /** Model transformation matrix. */
  transform: Matrix;
}

export const modelInstances: ModelInstance[] = [];

/** A game entity, which other objects can collide with. */
export interface Collider extends EntityBase {
  /** The entity position. */
  pos: Readonly<Vector>;
  /** The entity collision radius. */
  radius: number;

  /** Damage this entity. */
  damage(): void;

  /** Arrow for debugging view. */
  debugArrow?: Vector;
}

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
}
