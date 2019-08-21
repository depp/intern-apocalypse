/**
 * Walking movement.
 */

import { DebugColor } from './debug';
import { Edge } from './level';
import {
  Vector,
  length,
  madd,
  maddSubtract,
  distance,
  lerp,
  lineNormal,
  lineLineIntersection,
  lengthSquared,
  dotSubtract,
  distanceSquared,
  wedgeSubtract,
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
  let pos = start;
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
  let movementRemaining = 1;
  for (const edge of insetEdges) {
    const { vertex0, vertex1 } = edge;
    // Inlined the line-line collision function here. See lineLineIntersection
    // in math.ts for a description of how this works.
    const denom = wedgeSubtract(pos, target, vertex0, vertex1);
    if (denom <= 0) {
      continue;
    }
    const num1 = wedgeSubtract(vertex0, pos, vertex1, vertex0);
    const num2 = wedgeSubtract(vertex0, pos, target, pos);
    if (denom < num1 || num2 < 0 || denom < num2) {
      continue;
    }
    // Instead of 'num < 0', we use this check. This effectively starts the
    // trace from behind the current position, in case the collision response
    // puts us on the back side of an edge. This is not theoretical, it should
    // happen often, because the collision response will try to put us exactly
    // touching an edge and roundoff error will put us slightly to one side.
    if (distance(vertex0, vertex1) * num1 < -walkerRadius * denom) {
      continue;
    }
    edge.edge.debugColor = DebugColor.Red;
    // At this point, we have a positive collision.
    movementRemaining *= 1 - num1 / denom;
    // Position on edge, with vertex0..vertex1 as 0..1.
    const edgeFrac = num2 / denom;
    pos = lerp(vertex0, vertex1, edgeFrac);
    // Sliding along edge will add <v1-v0,m>/||v1-v0||^2 to the position.
    const edgeDeltaFrac =
      (movementRemaining * dotSubtract(vertex1, vertex0, movement)) /
      distanceSquared(vertex1, vertex0);
    let newEdgeFrac = edgeFrac + edgeDeltaFrac;
    if (newEdgeFrac < 0) {
      newEdgeFrac = 0;
      target = vertex0;
    } else if (edgeFrac > 1) {
      newEdgeFrac = 1;
      target = vertex1;
    } else {
      target = lerp(vertex0, vertex1, newEdgeFrac);
    }
    break;
  }
  return target;
}
