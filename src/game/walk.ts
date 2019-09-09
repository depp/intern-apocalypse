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
  dotSubtract,
  distanceSquared,
  wedgeSubtract,
  projectToCircle,
  vector,
  lerp1D,
  scaleVector,
} from '../lib/math';
import { level } from './world';
import { colliders } from './entity';

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
  vertex0: Vector;
  vertex1: Vector;
  hit?: Vector;
}

/** A corner for collision testing. */
interface CollisionCorner {
  pos: Vector;
  radius: number;
  edge0?: CollisionEdge;
  edge1?: CollisionEdge;
  hit?: Vector;
}

/** A segment of a walking path. */
export interface WalkSegment {
  /** The starting point of the segment. */
  start: Vector;
  /** The ending point of the segment. */
  end: Vector;
  /**
   * The direction, relative to movement, that we are sliding. +1 for left, -1
   * for right.
   */
  slideDirection: number;
  /** Amount of movement remaining once this segment starts. */
  startDistance: number;
  /** Amount of movement remaining once this segment ends. */
  endDistance: number;
  /** The edge that this segment is sliding along. */
  edge?: CollisionEdge;
  /** The corner that this segment is sliding around. */
  corner?: CollisionCorner;
}

function circleMovementPos(
  center: Vector,
  pos: Vector,
  direction: Vector,
): number {
  return (
    dotSubtract(center, pos, direction) /
    Math.abs(wedgeSubtract(center, pos, direction))
  );
}

/**
 * Test for collisions against an edge.
 * @param direction Input movement direction.
 * @param segment Previous movement segment.
 * @param edge Edge to test for collisions.
 */
function testEdge(
  direction: Vector,
  segment: WalkSegment,
  edge: CollisionEdge,
): WalkSegment | undefined {
  const { vertex0, vertex1 } = edge;
  const { start, end, corner } = segment;
  // Position we initially collide with the edge, with vertex0..vertex1 as 0..1.
  let edgeFrac: number;
  // Distance remaining when we collide with the edge.
  let startDistance: number;
  // Location where we collide with the edge.
  let newStart: Vector;
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
    // start from a short distance backwards, in case we have ended up on the
    // back side of an edge. This is expected to happen, because the collision
    // resolution will place us directly on an edge, and rounding error should
    // often move us slightly behind the edge.
    if (num1 * distance(start, end) < -backtrackDistance * denom) {
      // The edge is behind us.
      return;
    }
    edgeFrac = num2 / denom;
    startDistance = segment.startDistance * (1 - num1 / denom);
    newStart = lerp(vertex0, vertex1, edgeFrac);
    color = DebugColor.Yellow;
  } else if (corner.edge0 == edge) {
    if (end != edge.vertex1) {
      return;
    }
    startDistance = segment.endDistance;
    newStart = end;
    edgeFrac = 1;
    color = DebugColor.Green;
  } else if (corner.edge1 == edge) {
    if (end != edge.vertex0) {
      return;
    }
    startDistance = segment.endDistance;
    newStart = end;
    edgeFrac = 0;
    color = DebugColor.Green;
  } else {
    const { pos, radius } = corner;
    // Solve for the location of collisions along the line. Quadratic formula.
    const a = distanceSquared(vertex1, vertex0);
    const b = 2 * dotSubtract(vertex0, pos, vertex1, vertex0);
    const c = distanceSquared(vertex0, pos) - radius ** 2;
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
    if (dotSubtract(newStart, end, direction) >= 0) {
      // We leave the arc before hitting the line.
      return;
    }
    startDistance =
      segment.endDistance +
      (circleMovementPos(pos, newStart, direction) -
        circleMovementPos(pos, end, direction)) *
        radius;
    color = DebugColor.Magenta;
  }
  // At this point, we have a collision.
  if (isDebug) {
    edge.edge.debugColor = color;
  }
  // Position where we end movement, sliding along the edge.
  let newEnd: Vector;
  const edgeLengthSquared = distanceSquared(vertex1, vertex0);
  // Movement is projected onto the vector, giving new movement vector of:
  // distance * <dir, v1 - v0> / length(v1 - v0)
  const moveDot = dotSubtract(vertex1, vertex0, direction);
  const edgeDeltaFrac = (startDistance * moveDot) / edgeLengthSquared;
  let newEdgeFrac = edgeFrac + edgeDeltaFrac;
  let endDistance: number;
  if (newEdgeFrac <= 0) {
    newEnd = vertex0;
    endDistance = startDistance + (edgeFrac * edgeLengthSquared) / moveDot;
  } else if (newEdgeFrac >= 1) {
    newEnd = vertex1;
    endDistance =
      startDistance + ((edgeFrac - 1) * edgeLengthSquared) / moveDot;
  } else {
    newEnd = lerp(vertex0, vertex1, newEdgeFrac);
    endDistance = 0;
  }
  return {
    start: newStart,
    end: newEnd,
    slideDirection: Math.sign(moveDot),
    startDistance,
    endDistance,
    edge,
  };
}

/**
 * Test for collisions against a corner.
 * @param direction Input movement direction.
 * @param segment Previous movement segment.
 * @param corner Corner to test for collisions.
 */
function testCorner(
  direction: Vector,
  segment: WalkSegment,
  corner: CollisionCorner,
): WalkSegment | undefined {
  const { start, end, edge } = segment;
  const { pos, radius } = corner;
  let startDistance: number;
  let newStart: Vector;
  if (edge && edge == corner.edge0) {
    // We slid off an edge, this is the corner.
    if (end != edge.vertex1) {
      return;
    }
    startDistance = segment.endDistance;
    newStart = end;
  } else if (edge && edge == corner.edge1) {
    // We slid off the other edge.
    if (end != edge.vertex0) {
      return;
    }
    startDistance = segment.endDistance;
    newStart = end;
  } else if (segment.corner) {
    // Hitting a second corner.
    // FIXME: implement.
    return;
  } else {
    // Collision test: line vs circle.
    const a = distanceSquared(end, start);
    const b = 2 * dotSubtract(start, pos, end, start);
    const c = distanceSquared(start, pos) - radius ** 2;
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
    startDistance = lerp1D(
      segment.startDistance,
      segment.endDistance,
      testFrac,
    );
    newStart = lerp(start, end, testFrac);
  }
  let color = DebugColor.Magenta;
  // The amount sideways of movement that we hit the circle.
  const side = wedgeSubtract(pos, newStart, direction);
  // The final pos, if we are locked to the circle.
  let newEnd = projectToCircle(
    madd(newStart, direction, (Math.abs(side) * startDistance) / radius),
    pos,
    radius,
  );
  let endDistance = 0;
  if (dotSubtract(newEnd, pos, direction) > 0) {
    // We slide off the circle before reaching newEnd.
    const a = Math.sign(side) * radius;
    newEnd = vector(pos.x - a * direction.y, pos.y + a * direction.x);
    endDistance =
      startDistance +
      (circleMovementPos(pos, newEnd, direction) -
        circleMovementPos(pos, newStart, direction)) *
        radius;
    color = DebugColor.Cyan;
  }
  let edgeVertex: Vector | undefined;
  if (side < 0 && corner.edge0) {
    edgeVertex = corner.edge0.vertex1;
  } else if (side > 0 && corner.edge1) {
    edgeVertex = corner.edge1.vertex0;
  }
  if (edgeVertex && dotSubtract(newEnd, edgeVertex, direction) > 0) {
    // We slide onto an edge before reaching newEnd.
    newEnd = edgeVertex;
    endDistance =
      startDistance +
      (circleMovementPos(pos, newEnd, direction) -
        circleMovementPos(pos, newStart, direction)) *
        radius;
    color = DebugColor.Blue;
  }
  if (isDebug) {
    if (corner.edge1) {
      corner.edge1.edge.debugVertexColor = color;
    }
  }
  return {
    start: newStart,
    end: newEnd,
    slideDirection: Math.sign(side),
    startDistance,
    endDistance,
    corner,
  };
}

/**
 * Resolve walking movement.
 * @param start The point where movement starts.
 * @param movement The amount of movement that would happen if unobstructed.
 * @returns The point where movement ends.
 */
export function walk(start: Vector, movement: Vector): Vector {
  const movementDistance = length(movement);
  if (movementDistance == 0) {
    return start;
  }
  const direction = scaleVector(movement, 1 / movementDistance);
  // Due to the way collisions are resolved, the player may be pushed off axis,
  // but will always stay within a circle whose opposite points are the starting
  // point and the target point.
  const areaCenter = madd(start, movement, 0.5);
  const areaRadius = walkerRadius + 0.5 * movementDistance + 0.1;
  const rawEdges = level.findUnpassableEdges(areaCenter, areaRadius);
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
          pos: edge0.edge.vertex1,
          radius: walkerRadius,
          edge0,
          edge1,
        });
      }
    }
  }
  for (const entity of colliders) {
    const { pos, radius } = entity;
    // pos == start will be true exactly for the entity that is walking. It is
    // should not be necessary to exclude the walker during collision tests,
    // since the walker is always walking away from itself, but this makes it
    // easier to debug.
    if (
      pos != start &&
      distanceSquared(areaCenter, pos) < (areaRadius + radius) ** 2
    ) {
      corners.push({ pos, radius: radius + walkerRadius });
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
    startDistance: movementDistance,
    endDistance: 0,
  };
  // We ignore collisions if we haven't traveled at least this far.
  const suppressionTresholdSquared = 0.01;
  for (
    let testNum = 0;
    testNum < 9 && currentSegment.startDistance > 0;
    testNum++
  ) {
    let nextSegment: WalkSegment = {
      start: currentSegment.end,
      end: madd(currentSegment.end, direction, currentSegment.endDistance),
      slideDirection: 0,
      startDistance: currentSegment.endDistance,
      endDistance: 0,
    };
    for (const edge of edges) {
      if (
        !edge.hit ||
        distanceSquared(currentSegment.start, edge.hit) >
          suppressionTresholdSquared
      ) {
        const segment = testEdge(direction, currentSegment, edge);
        if (segment && segment.startDistance >= nextSegment.startDistance) {
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
        const segment = testCorner(direction, currentSegment, corner);
        if (segment && segment.startDistance >= nextSegment.startDistance) {
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
