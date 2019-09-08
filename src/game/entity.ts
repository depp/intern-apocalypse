import { Vector, distanceSquared } from '../lib/math';

/** A game entity, which other objects can collide with. */
export interface Collider {
  /** The entity position. */
  pos: Readonly<Vector>;
  /** The entity collision radius. */
  radius: number;

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
export interface Entity {
  /** Update the entity. Called every frame. */
  update(): void;
}

/** List of all active entities in the world. */
export const entities: Entity[] = [];

/** Update all enteties. */
export function updateEntities(): void {
  for (const entity of entities) {
    entity.update();
  }
}
