/**
 * Walking movement.
 */

import { DebugColor } from './debug';
import { Edge } from './level';
import {
  Vector,
  length,
  madd,
  lineNormal,
  lineLineIntersection,
  lengthSquared,
  dotSubtract,
} from './math';
import { level } from './world';

/** The collision radius of walking entities. */
export const walkerRadius = 0.5;

/**
 * Resolve walking movement.
 * @param start The point where movement starts.
 * @param movement The amount of movement that would happen if unobstructed.
 * @returns The point where movement ends.
 */
export function walk(
  start: Readonly<Vector>,
  movement: Readonly<Vector>,
): Readonly<Vector> {
  const travelDistanceSquared = lengthSquared(movement);
  if (travelDistanceSquared == 0) {
    return start;
  }
  // Fudge factor... after resolving a collision with an edge, we may end up on
  // the wrong side. This ensures that we will continue to collide with the same
  // edge.
  let pos = madd(start, movement, -0.01 / Math.sqrt(travelDistanceSquared));
  let target = madd(start, movement);
  // Due to the way collisions are resolved, the player may be pushed off axis,
  // but will always stay within a circle whose opposite points are the starting
  // point and the target point.
  const rawEdges = level.findEdges(
    madd(start, movement, 0.5),
    walkerRadius + length(movement) + 0.1,
  );
  interface InsetEdge {
    edge: Edge;
    vertex0: Readonly<Vector>;
    vertex1: Readonly<Vector>;
  }
  let insetEdges: InsetEdge[] = [];
  for (const edge of rawEdges) {
    const { vertex0, vertex1 } = edge;
    const norm = lineNormal(vertex0, vertex1);
    insetEdges.push({
      edge,
      vertex0: madd(vertex0, norm, walkerRadius),
      vertex1: madd(vertex1, norm, walkerRadius),
    });
  }
  let hasCollision = false;
  for (const edge of insetEdges) {
    const { vertex0, vertex1 } = edge;
    const alpha = lineLineIntersection(pos, target, vertex0, vertex1);
    if (alpha != -1) {
      edge.edge.debugColor = DebugColor.Red;
      pos = madd(pos, movement, alpha);
      hasCollision = true;
      break;
    }
  }
  if (!hasCollision) {
    pos = target;
  }
  // Remove fudge factor.
  if (dotSubtract(pos, start, movement) <= 0) {
    return start;
  }
  return pos;
}
