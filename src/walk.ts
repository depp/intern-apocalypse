/**
 * Walking movement.
 */

import { DebugColor } from './debug';
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

/** An edge for collision testing. */
export interface CollisionEdge {
  edge: Edge; // FIXME: not necessary in release?
  vertex0: Readonly<Vector>;
  vertex1: Readonly<Vector>;
}

/** A segment of a walking path. */
export interface WalkSegment {
  /** The starting point of the segment. */
  start: Readonly<Vector>;
  /** The ending point of the segment. */
  end: Readonly<Vector>;
  /**
   * The direction, relative to movement, that we are sliding. +1 for left, -1
   * for right.
   */
  slideDirection: number;
  /** Fraction of movement remaining once this segment starts. */
  startFraction: number;
  /** Fraction of movement remaining once this segment ends. */
  endFraction: number;
  /** The edge that this segment is sliding along. */
  edge?: CollisionEdge;
}

/**
 * Test for collisions against an edge.
 * @param movement Input movement vector.
 * @param segment Previous movement segment.
 * @param edge Edge to test for collisions.
 */
function testEdge(
  movement: Readonly<Vector>,
  segment: WalkSegment,
  edge: CollisionEdge,
): WalkSegment | undefined {
  const { vertex0, vertex1 } = edge;
  const { start, end } = segment;
  if (edge == segment.edge) {
    return;
  }
  // Collision test: line vs line.
  // Inlined the line-line collision function here. See lineLineIntersection
  // in math.ts for a description of how this works.
  const denom = wedgeSubtract(start, end, vertex0, vertex1);
  if (denom <= 0) {
    // We are going from the back side to the front side of the edge, or
    // parallel to the edge. This should not register a collision, so we can
    // escape if we get stuck on the back side of an edge. This should
    // happen often due to rounding error.
    return;
  }
  const num1 = wedgeSubtract(vertex0, start, vertex1, vertex0);
  const num2 = wedgeSubtract(vertex0, start, end, start);
  if (denom <= num1) {
    // We don't reach the edge.
    return;
  }
  if (num2 < 0 || denom < num2) {
    // We pass by the edge to the right (num2 < 0) or left (denom < num2).
    return;
  }
  // Check if we start in front of the edge. Instead of testing from pos, we
  // start from 'walkerRadius' backwards, in case we have ended up on the
  // back side of an edge. This is expected to happen, because the collision
  // resolution will place us directly on an edge, and rounding error should
  // often move us slightly behind the edge.
  if ((num1 / denom) * distance(start, end) < -walkerRadius) {
    // The edge is behind us.
    return;
  }
  // Position on edge, with vertex0..vertex1 as 0..1.
  const edgeFrac = num2 / denom;
  const startFraction = 1 - num1 / denom;
  const newStart = lerp(vertex0, vertex1, edgeFrac);
  // At this point, we have a collision. It just may not be the first collision
  // in the path.
  if (!edge.edge.debugColor) {
    edge.edge.debugColor = DebugColor.Yellow;
  }
  let newEnd: Readonly<Vector>;
  // Factor to multiply movement by due to sliding.
  const hitSlideFactor = dotSubtract(vertex1, vertex0, movement);
  // Sliding along edge will add <v1-v0,m>/||v1-v0||^2 to the position.
  const edgeDeltaFrac =
    (startFraction * hitSlideFactor) / distanceSquared(vertex1, vertex0);
  let newEdgeFrac = edgeFrac + edgeDeltaFrac;
  let endFraction = 0;
  if (newEdgeFrac <= 0) {
    newEnd = vertex0;
    endFraction = newEdgeFrac / edgeDeltaFrac;
  } else if (newEdgeFrac >= 1) {
    newEnd = vertex1;
    endFraction = (newEdgeFrac - 1) / edgeDeltaFrac;
  } else {
    newEnd = lerp(vertex0, vertex1, newEdgeFrac);
  }
  return {
    start: newStart,
    end: newEnd,
    slideDirection: Math.sign(hitSlideFactor),
    startFraction,
    endFraction,
    edge,
  };
}

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
  if (lengthSquared(movement) == 0) {
    return start;
  }
  // Due to the way collisions are resolved, the player may be pushed off axis,
  // but will always stay within a circle whose opposite points are the starting
  // point and the target point.
  const rawEdges = level.findUnpassableEdges(
    madd(start, movement, 0.5),
    walkerRadius + 0.5 * length(movement) + 0.1,
  );
  let edges: CollisionEdge[] = [];
  for (const edge of rawEdges) {
    const { vertex0, vertex1 } = edge;
    const norm = lineNormal(vertex0, vertex1);
    edges.push({
      edge,
      vertex0: madd(vertex0, norm, walkerRadius),
      vertex1: madd(vertex1, norm, walkerRadius),
    });
  }
  // We start with a path segment under test. On each iteration, we see if that
  // segment is interrupted. If it is, we try again with a segment that moves
  // around the obstacle. We try a maximum of 9 times, just to avoid any
  // potential infinite loop if there is an error in this code.
  let currentSegment: WalkSegment = {
    start,
    end: madd(start, movement),
    slideDirection: 0,
    startFraction: 1,
    endFraction: 0,
  };
  for (
    let testNum = 0;
    testNum < 9 && currentSegment.startFraction > 0;
    testNum++
  ) {
    let nextSegment: WalkSegment = {
      start: currentSegment.end,
      end: madd(currentSegment.end, movement, currentSegment.endFraction),
      slideDirection: 0,
      startFraction: currentSegment.endFraction,
      endFraction: 0,
    };
    for (const edge of edges) {
      const segment = testEdge(movement, currentSegment, edge);
      if (segment && segment.startFraction >= nextSegment.startFraction) {
        nextSegment = segment;
      }
    }
    const isWedged =
      currentSegment.slideDirection * nextSegment.slideDirection < 0;
    currentSegment = nextSegment;
    if (isWedged) {
      break;
    }
  }
  // This seems like it should be 'end', but 'start' is correct.
  return currentSegment.start;
}