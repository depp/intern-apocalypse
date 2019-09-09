import {
  Vector,
  madd,
  length,
  distanceSquared,
  newRect,
  initRect,
  rectAddCircle,
  rectsIntersect,
  dotSubtract,
  wedgeSubtract,
  distance,
  vector,
} from '../lib/math';
import { EntityBase } from './entity';
import { isDebug, DebugColor } from '../debug/debug';
import { frameDT } from './time';
import { debugMarks } from '../debug/mark';
import { level } from './world';
import { Edge } from './level';

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

  // Color of current group, on map.
  let color: DebugColor = 1;

  /** Bounds of the current group. */
  const bounds = newRect();

  // Edges we can collide with.
  const edges: Edge[] = [];
  // Edge vertexes we can collide with.
  const vertexes: Vector[] = [];

  // Get static colliders.
  function initStatic(): void {
    edges.length = 0;
    vertexes.length = 0;
    for (const cell of level.cells) {
      if (rectsIntersect(cell.bounds, bounds)) {
        for (const edge of cell.edges()) {
          const { passable, vertex0, vertex1 } = edge;
          if (!passable) {
            edges.push(edge);
            if (isDebug) {
              edge.debugColor = color;
            }
            if (!vertexes.includes(vertex0)) {
              vertexes.push(vertex0);
            }
            if (!vertexes.includes(vertex1)) {
              vertexes.push(vertex1);
            }
          }
        }
      }
    }
  }

  // Resolve a collision with an edge. Returns null if we do not collide with
  // the given edge.
  function resolveEdge(pos: Vector, radius: number, edge: Edge): Vector | null {
    const { vertex0, vertex1 } = edge;
    const edgeLen = distance(vertex0, vertex1);
    // Perpendicular component.
    const perp = wedgeSubtract(vertex1, vertex0, pos, vertex0) / edgeLen;
    if (perp > radius || perp < 0) {
      return null;
    }
    // Parallel component.
    const par = dotSubtract(vertex1, vertex0, pos, vertex0) / edgeLen;
    if (par < 0 || edgeLen < par) {
      return null;
    }
    // Project the object out of the edge.
    const amt = (radius - perp) / edgeLen;
    return vector(
      pos.x - amt * (vertex1.y - vertex0.y),
      pos.y + amt * (vertex1.x - vertex0.x),
    );
  }

  // Resolve a collision with static objects.
  function resolveStatic(pos: Vector, radius: number): Vector {
    let result = pos;
    for (const edge of edges) {
      const candidate = resolveEdge(pos, radius, edge);
      if (
        candidate &&
        distanceSquared(candidate, pos) > distanceSquared(result, pos)
      ) {
        result = candidate;
      }
    }
    return result || null;
  }

  // Handle singleton.
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

    initRect(bounds);
    rectAddCircle(bounds, entity.pos, entity.radius);
    initStatic();

    const ent = entity.entity;
    const pos = madd(ent.pos, ent.velocity, frameDT);
    const cpos = resolveStatic(pos, ent.radius);
    ent.pos = cpos || pos;
  }

  for (const group of groups.values()) {
    color++;

    initRect(bounds);
    for (const { pos, radius } of group) {
      rectAddCircle(bounds, pos, radius);
    }
    initStatic();

    if (isDebug) {
      debugMarks.push({
        time: 0,
        kind: 'rectangle',
        rect: Object.assign({}, bounds),
        color,
      });
    }

    for (const entity of group) {
      const ent = entity.entity;
      const pos = madd(ent.pos, ent.velocity, frameDT);
      const cpos = resolveStatic(pos, ent.radius);
      ent.pos = cpos || pos;
    }
  }
}

export function resetColliders(): void {
  colliders = [];
}
