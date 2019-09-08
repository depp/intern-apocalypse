/**
 * Walking movement.
 */

import { isDebug, DebugColor } from '../debug/debug';
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
  projectToCircle,
  vector,
  lerp1D,
} from '../lib/math';
import { level } from './world';

/**
 * Distance we will look backwards to calculate collisions, if we end up on the
 * wrong side of an edge due to rounding errors.
 */
const backtrackDistance = 0.001;

/** The collision radius of walking entities. */
export const walkerRadius = 0.5;

/** An edge for collision testing. */
export interface CollisionEdge {
  edge: Edge; // FIXME: not necessary in release?
  vertex0: Readonly<Vector>;
  vertex1: Readonly<Vector>;
  hit?: Readonly<Vector>;
}

/** A corner for collision testing. */
interface CollisionCorner {
  center: Readonly<Vector>;
  edge0: CollisionEdge;
  edge1: CollisionEdge;
  hit?: Readonly<Vector>;
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
  /** The corner that this segment is sliding around. */
  corner?: CollisionCorner;
}

function circleMovementPos(
  center: Readonly<Vector>,
  pos: Readonly<Vector>,
  movement: Readonly<Vector>,
): number {
  return (
    dotSubtract(center, pos, movement) /
    Math.abs(wedgeSubtract(center, pos, movement))
  );
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
  const { start, end, corner } = segment;
  // Position on edge, with vertex0..vertex1 as 0..1.
  let edgeFrac: number;
  let startFraction: number;
  let newStart: Readonly<Vector>;
  let color: DebugColor;
  if (!corner) {
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
    if ((num1 / denom) * distance(start, end) < -backtrackDistance) {
      // The edge is behind us.
      return;
    }
    edgeFrac = num2 / denom;
    startFraction = 1 - num1 / denom;
    newStart = lerp(vertex0, vertex1, edgeFrac);
    color = DebugColor.Yellow;
  } else if (corner.edge0 == edge) {
    if (end != edge.vertex1) {
      return;
    }
    startFraction = segment.endFraction;
    newStart = end;
    edgeFrac = 1;
    color = DebugColor.Green;
  } else if (corner.edge1 == edge) {
    if (end != edge.vertex0) {
      return;
    }
    startFraction = segment.endFraction;
    newStart = end;
    edgeFrac = 0;
    color = DebugColor.Green;
  } else {
    const { center } = corner;
    // Solve for the location of collisions along the line. Quadratic formula.
    const a = distanceSquared(vertex1, vertex0);
    const b = dotSubtract(vertex0, center, vertex1, vertex0);
    const c = distanceSquared(vertex0, center) - walkerRadius ** 2;
    const discriminant = b ** 2 - 4 * a * c;
    if (discriminant <= 0) {
      // We don't intersect the edge, or we barely touch it.
      return;
    }
    edgeFrac =
      (-b + segment.slideDirection * Math.sqrt(discriminant)) / (2 * a);
    if (edgeFrac < 0 || 1 < edgeFrac) {
      // We miss the edge.
      return;
    }
    newStart = lerp(vertex0, vertex1, edgeFrac);
    if (dotSubtract(newStart, end, movement) >= 0) {
      // We leave the arc before hitting the line.
      return;
    }
    startFraction =
      segment.endFraction +
      ((circleMovementPos(center, newStart, movement) -
        circleMovementPos(center, end, movement)) *
        walkerRadius) /
        length(movement);
    color = DebugColor.Magenta;
  }
  // At this point, we have a collision. It just may not be the first collision
  // in the path.
  if (isDebug) {
    if (!edge.edge.debugColor) {
      edge.edge.debugColor = color;
    }
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
 * Test for collisions against a corner.
 * @param movement Input movement vector.
 * @param segment Previous movement segment.
 * @param corner Corner to test for collisions.
 */
function testCorner(
  movement: Readonly<Vector>,
  segment: WalkSegment,
  corner: CollisionCorner,
): WalkSegment | undefined {
  const { start, end, edge } = segment;
  const { center } = corner;
  let startFraction: number;
  let newStart: Readonly<Vector>;
  if (edge == corner.edge0) {
    // We slid off an edge, this is the corner.
    if (end != edge.vertex1) {
      return;
    }
    startFraction = segment.endFraction;
    newStart = end;
  } else if (edge == corner.edge1) {
    // We slid off the other edge.
    if (end != edge.vertex0) {
      return;
    }
    startFraction = segment.endFraction;
    newStart = end;
  } else if (segment.corner) {
    // Hitting a second corner.
    // FIXME: implement.
    return;
  } else {
    // Collision test: line vs circle.
    const a = distanceSquared(end, start);
    const b = 2 * dotSubtract(start, center, end, start);
    const c = distanceSquared(start, center) - walkerRadius ** 2;
    const discriminant = b ** 2 - 4 * a * c;
    if (discriminant <= 0) {
      // Circle not touching (or exactly touching) line.
      return;
    }
    const testFrac = (0.5 * (-b - Math.sqrt(discriminant))) / a;
    if (testFrac >= 1) {
      // We don't reach the corner.
      return;
    }
    if (testFrac * Math.sqrt(a) < -backtrackDistance) {
      // We are heading away from the corner.
      return;
    }
    startFraction = lerp1D(
      segment.startFraction,
      segment.endFraction,
      testFrac,
    );
    newStart = lerp(start, end, testFrac);
  }
  let color: DebugColor;
  const offset = wedgeSubtract(center, newStart, movement);
  const moveLength = length(movement);
  let newEnd = madd(
    newStart,
    movement,
    Math.abs(offset) / (walkerRadius * moveLength),
  );
  let edgeVertex = offset < 0 ? corner.edge0.vertex1 : corner.edge1.vertex0;
  let endFraction = 0;
  if (
    dotSubtract(edgeVertex, center, movement) < Infinity &&
    dotSubtract(edgeVertex, newEnd, movement) < 0
  ) {
    // We slide off the vertex onto an edge.
    newEnd = edgeVertex;
    endFraction =
      startFraction -
      ((circleMovementPos(center, newStart, movement) -
        circleMovementPos(center, edgeVertex, movement)) *
        walkerRadius) /
        moveLength;
    color = DebugColor.Blue;
  } else if (dotSubtract(newEnd, center, movement) > 0) {
    // We slide off the vertex into open space.
    const dx = -offset * movement.y;
    const dy = offset * movement.x;
    const a = walkerRadius / Math.hypot(dx, dy);
    newEnd = vector(center.x + a * dx, center.y + a * dy);
    endFraction =
      startFraction -
      (circleMovementPos(center, newStart, movement) * walkerRadius) /
        moveLength;
    color = DebugColor.Cyan;
  } else {
    // We stay sliding along the vertex.
    newEnd = projectToCircle(newEnd, center, walkerRadius);
    endFraction = 0;
    color = DebugColor.Magenta;
  }
  if (isDebug) {
    if (!corner.edge1.edge.debugVertexColor) {
      corner.edge1.edge.debugVertexColor = color;
    }
    if (offset < 0) {
      corner.edge0.edge.debugColor = DebugColor.Green;
    } else {
      corner.edge1.edge.debugColor = DebugColor.Green;
    }
  }
  return {
    start: newStart,
    end: newEnd,
    slideDirection: Math.sign(offset),
    startFraction,
    endFraction,
    corner,
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
  const corners: CollisionCorner[] = [];
  for (const edge0 of edges) {
    for (const edge1 of edges) {
      if (
        edge0.edge.vertex1 == edge1.edge.vertex0 &&
        wedgeSubtract(
          edge0.edge.vertex1,
          edge0.edge.vertex0,
          edge1.edge.vertex1,
          edge1.edge.vertex0,
        ) < 0
      ) {
        corners.push({
          center: edge0.edge.vertex1,
          edge0,
          edge1,
        });
      }
    }
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
  // We ignore collisions if we haven't traveled at least this far.
  const suppressionTresholdSquared = 0.01;
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
      if (
        !edge.hit ||
        distanceSquared(currentSegment.start, edge.hit) >
          suppressionTresholdSquared
      ) {
        const segment = testEdge(movement, currentSegment, edge);
        if (segment && segment.startFraction >= nextSegment.startFraction) {
          nextSegment = segment;
        }
      }
    }
    for (const corner of corners) {
      if (
        !corner.hit ||
        distanceSquared(currentSegment.start, corner.hit) >
          suppressionTresholdSquared
      ) {
        const segment = testCorner(movement, currentSegment, corner);
        if (segment && segment.startFraction >= nextSegment.startFraction) {
          nextSegment = segment;
        }
      }
    }
    const isWedged =
      currentSegment.slideDirection * nextSegment.slideDirection < 0;
    currentSegment = nextSegment;
    if (isWedged) {
      break;
    }
    if (currentSegment.edge) {
      currentSegment.edge.hit = currentSegment.start;
    }
    if (currentSegment.corner) {
      currentSegment.corner.hit = currentSegment.start;
    }
  }
  if (false) {
    const dotv = dotSubtract(currentSegment.start, start, movement);
    if (dotv < 0) {
      console.warn('bad walk');
    }
  }
  // This seems like it should be 'end', but 'start' is correct.
  return currentSegment.start;
}
