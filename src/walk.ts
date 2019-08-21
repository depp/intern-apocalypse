/**
 * Walking movement.
 */

import { DebugColor, AssertionError } from './debug';
import { Edge } from './level';
import {
  Vector,
  length,
  madd,
  distance,
  lerp,
  lineNormal,
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
  // Fraction of the total movement remaining.
  let movementRemaining = 1;
  // The current edge we are sliding against.
  let slideEdge: InsetEdge | undefined;
  let slideFactor: number | undefined;
  // Maximum 9 collision test loops before we give up, just to avoid a potential
  // infinite loop if the logic is incorrect somewhere. In each loop, we start
  // with movement from 'pos' to 'target', and see if that movement is
  // interrupted by an obstacle. If it is interrupted, we create a new
  // trajectory that slides around the obstacle.
  let testNum: number;
  for (testNum = 0; testNum < 9 && movementRemaining > 0; testNum++) {
    // The new trajectory after hitting an edge.
    let hitEdge: InsetEdge | undefined;
    let hitPos: Vector | undefined;
    let hitSlideFactor: number | undefined;
    let hitTarget: Vector | undefined;
    let hitFrac: number | undefined;
    for (const edge of insetEdges) {
      if (edge == slideEdge) {
        // We are already sliding along this edge.
        continue;
      }
      const { vertex0, vertex1 } = edge;
      // Inlined the line-line collision function here. See lineLineIntersection
      // in math.ts for a description of how this works.
      const denom = wedgeSubtract(pos, target, vertex0, vertex1);
      if (denom <= 0) {
        // We are going from the back side to the front side of the edge, or
        // parallel to the edge. This should not register a collision, so we can
        // escape if we get stuck on the back side of an edge. This should
        // happen often due to rounding error.
        edge.edge.debugColor = DebugColor.Gray;
        continue;
      }
      const num1 = wedgeSubtract(vertex0, pos, vertex1, vertex0);
      const num2 = wedgeSubtract(vertex0, pos, target, pos);
      if (denom <= num1) {
        // We don't reach the edge.
        edge.edge.debugColor = DebugColor.Gray;
        continue;
      }
      if (num2 < 0 || denom < num2) {
        // We pass by the edge to the right (num2 < 0) or left (denom < num2).
        edge.edge.debugColor = DebugColor.Yellow;
        continue;
      }
      // Check if we start in front of the edge. Instead of testing from pos, we
      // start from 'walkerRadius' backwards, in case we have ended up on the
      // back side of an edge. This is expected to happen, because the collision
      // resolution will place us directly on an edge, and rounding error should
      // often move us slightly behind the edge.
      const testFrac = 1 - num1 / denom;
      if ((num1 / denom) * distance(pos, target) < -walkerRadius) {
        // The edge is behind us.
        edge.edge.debugColor = DebugColor.Green;
        continue;
      }
      if (hitFrac != null && testFrac <= hitFrac) {
        // A previous test collided sooner.
        edge.edge.debugColor = DebugColor.Gray;
        continue;
      }
      // At this point, we have a positive collision.
      hitEdge = edge;
      // Position on edge, with vertex0..vertex1 as 0..1.
      const edgeFrac = num2 / denom;
      hitPos = lerp(vertex0, vertex1, edgeFrac);
      // Factor to multiply movement by due to sliding.
      hitSlideFactor = dotSubtract(vertex1, vertex0, movement);
      if (
        !hitSlideFactor ||
        (slideFactor && Math.sign(slideFactor) != Math.sign(hitSlideFactor))
      ) {
        // The edge is perpendicular to our path (!newSlideFactor) or we are
        // wedged in a corner (slideFactor changes sign).
        hitTarget = hitPos;
        hitFrac = 1;
        // FIXME: debug only.
        edge.edge.debugColor = DebugColor.Blue;
      } else {
        hitFrac = testFrac;
        // Sliding along edge will add <v1-v0,m>/||v1-v0||^2 to the position.
        const edgeDeltaFrac =
          (testFrac * hitSlideFactor) / distanceSquared(vertex1, vertex0);
        let newEdgeFrac = edgeFrac + edgeDeltaFrac;
        if (newEdgeFrac <= 0) {
          newEdgeFrac = 0;
          hitTarget = vertex0;
          edge.edge.debugColor = DebugColor.Cyan;
        } else if (newEdgeFrac >= 1) {
          newEdgeFrac = 1;
          hitTarget = vertex1;
          edge.edge.debugColor = DebugColor.Magenta;
        } else {
          hitTarget = lerp(vertex0, vertex1, newEdgeFrac);
          edge.edge.debugColor = DebugColor.Red;
        }
      }
      break;
    }
    if (!hitEdge) {
      // No collisions on this loop, we are done.
      pos = target;
      break;
    }
    if (
      hitPos == null ||
      hitSlideFactor == null ||
      hitTarget == null ||
      hitFrac == null
    ) {
      throw new AssertionError('invalid collision test');
    }
    slideEdge = hitEdge;
    pos = hitPos;
    slideFactor = hitSlideFactor;
    target = hitTarget;
    movementRemaining *= hitFrac;
  }
  return pos;
}
