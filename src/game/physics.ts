import {
  Vector,
  madd,
  length,
  distanceSquared,
  vector,
  newRect,
  rectFromCircle,
  rectUnion,
} from '../lib/math';
import { EntityBase } from './entity';
import { isDebug } from '../debug/debug';
import { frameDT } from './time';
import { debugMarks } from '../debug/mark';

/** A game entity, which other objects can collide with. */
export interface Collider extends EntityBase {
  /** The entity position. */
  pos: Vector;
  /** The entity velocity, in meters per second. */
  velocity: Vector;
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

/** List of all colliders in the level. */
export let colliders: Collider[];

/** Find all colliders which touch the given circle. */
export function findColliders(center: Vector, radius: number): Collider[] {
  const result: Collider[] = [];
  for (const entity of colliders) {
    if (
      !entity.isDead &&
      distanceSquared(center, entity.pos) <= (radius + entity.radius) ** 2
    ) {
      result.push(entity);
    }
  }
  return result;
}

/**
 * Update all colliders in the level.
 */
export function updateColliders(): void {
  // A collider, with a pointer to a representative of each group of colliding
  // entities.
  interface CollisionEntity {
    root: CollisionEntity;
    rank: number;
    entity: Collider;
    movement: number;
    pos: Vector;
    radius: number;
  }

  // All moving entities.
  const entities: CollisionEntity[] = [];

  // Find the root of a group of colliders.
  function findRoot(entity: CollisionEntity): CollisionEntity {
    const { root } = entity;
    if (root == entity) {
      return entity;
    }
    return (entity.root = findRoot(root));
  }

  // Join two groups of colliders.
  function union(e1: CollisionEntity, e2: CollisionEntity): void {
    let r1 = findRoot(e1);
    let r2 = findRoot(e2);
    if (r1.rank < r2.rank) {
      [r1, r2] = [r2, r1];
    }
    r2.root = r1;
    if (r1.rank == r2.rank) {
      r1.rank++;
    }
  }

  // Create a group for each collider.
  for (let i = 0; i < colliders.length; i++) {
    const entity = colliders[i];
    const movement = length(entity.velocity) * frameDT;
    const cent: {
      [N in Exclude<keyof CollisionEntity, 'root'>]: CollisionEntity[N];
    } = {
      rank: 0,
      entity,
      movement,
      pos: madd(entity.pos, entity.velocity, 0.5 * frameDT),
      radius: entity.radius + 0.5 * movement,
    };
    entities.push(((cent as CollisionEntity).root = cent as CollisionEntity));
  }

  // Join touching groups.
  for (let i = 1; i < entities.length; i++) {
    const e1 = entities[i];
    for (let j = 0; j < i; j++) {
      const e2 = entities[j];
      if (
        distanceSquared(e1.pos, e2.pos) <
        (e1.radius + e2.radius) ** 2 + 0.1
      ) {
        union(e1, e2);
      }
    }
  }

  // Create a list for each group.
  const groups = new Map<CollisionEntity, CollisionEntity[]>();
  const singles: CollisionEntity[] = [];
  for (const entity of entities) {
    if (entity.root == entity && !entity.rank) {
      singles.push(entity);
    } else {
      const root = findRoot(entity);
      let group = groups.get(root);
      if (!group) {
        group = [];
        groups.set(root, group);
      }
      group.push(entity);
    }
  }

  /** Bounds of the current group. */
  const bounds = newRect();
  const entityBounds = newRect();

  for (const entity of singles) {
    if (isDebug) {
      debugMarks.push({
        time: 0,
        kind: 'circle',
        pos: entity.pos,
        radius: entity.radius,
        color: 1,
      });
    }

    const ent = entity.entity;
    ent.pos = madd(ent.pos, ent.velocity, frameDT);
  }
  let color = 1;
  for (const group of groups.values()) {
    color++;
    rectFromCircle(bounds, group[0].pos, group[0].radius);
    for (const { pos, radius } of group) {
      rectFromCircle(entityBounds, pos, radius);
      rectUnion(bounds, entityBounds);
    }

    if (isDebug) {
      color++;
      debugMarks.push({
        time: 0,
        kind: 'rectangle',
        rect: Object.assign({}, bounds),
        color,
      });
    }

    for (const entity of group) {
      const ent = entity.entity;
      ent.pos = madd(ent.pos, ent.velocity, frameDT);
    }
  }
}

export function resetColliders(): void {
  colliders = [];
}
