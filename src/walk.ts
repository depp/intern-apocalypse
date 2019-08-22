/**
 * Walking movement.
 */

import { DebugColor, AssertionError } from './debug';
import { Edge, Cell } from './level';
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

interface InsetEdge {
  edge: Edge;
  vertex0: Readonly<Vector>;
  vertex1: Readonly<Vector>;
  sliding: boolean;
}

class LogTest {
  readonly edge: InsetEdge;
  readonly messages: string[] = [];
  constructor(edge: InsetEdge) {
    this.edge = edge;
  }
  write(message: string, data?: any & object): void {
    if (data) {
      message = `${message}\n${JSON.stringify(data, null, 2)}`;
    }
    this.messages.push(message);
  }
}

interface SegmentInfo {
  movementRemaining: number;
  slideFactor: number | undefined;
  pos: Readonly<Vector>;
  target: Readonly<Vector>;
}

interface LogSegment extends SegmentInfo {
  tests: LogTest[];
}

class Logger {
  private start: Readonly<Vector> | null = null;
  private movement: Readonly<Vector> | null = null;
  private readonly segments: LogSegment[] = [];
  startWalk(start: Readonly<Vector>, movement: Readonly<Vector>) {
    this.start = start;
    this.movement = movement;
    this.segments.length = 0;
  }
  startSegment(info: SegmentInfo): void {
    this.segments.push(
      Object.assign({}, info, {
        tests: [],
      }),
    );
  }
  addTest(edge: InsetEdge): LogTest {
    if (!this.segments.length) {
      throw new AssertionError('no segments');
    }
    const segment = this.segments[this.segments.length - 1];
    const test = new LogTest(edge);
    segment.tests.push(test);
    return test;
  }
  dump(): void {
    console.log('%cCollision test', 'font-size: 150%; font-weight: bold;');
    console.log(
      JSON.stringify(
        {
          start: this.start,
          movement: this.movement,
        },
        null,
        2,
      ),
    );
    const center = madd(this.start!, this.movement!, 0.5);
    for (let i = 0; i < this.segments.length; i++) {
      console.log(`%cSegment ${i}`, 'font-weight: bold;');
      const segment = this.segments[i];
      const obj = Object.assign(
        {
          posDistance: distance(segment.pos, center),
          targetDistance: distance(segment.target, center),
        },
        segment,
      );
      delete obj.tests;
      console.log(JSON.stringify(obj, null, 2));
      for (const test of this.segments[i].tests) {
        const edge = test.edge.edge;
        console.log(`Edge: ${edge.index} (cell ${edge.cell!.index})`);
        for (const msg of test.messages) {
          console.log(msg);
        }
      }
    }
  }
}

let logger: Logger | undefined;
let prevLogger: Logger | undefined;

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
  logger = new Logger();
  logger.startWalk(start, movement);
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
  let insetEdges: InsetEdge[] = [];
  for (const edge of rawEdges) {
    const { vertex0, vertex1 } = edge;
    const norm = lineNormal(vertex0, vertex1);
    insetEdges.push({
      edge,
      vertex0: madd(vertex0, norm, walkerRadius),
      vertex1: madd(vertex1, norm, walkerRadius),
      sliding: false,
    });
  }
  // Fraction of the total movement remaining.
  let movementRemaining = 1;
  // The current direction we are sliding.
  let slideFactor: number | undefined;
  // Maximum 9 collision test loops before we give up, just to avoid a potential
  // infinite loop if the logic is incorrect somewhere. In each loop, we start
  // with movement from 'pos' to 'target', and see if that movement is
  // interrupted by an obstacle. If it is interrupted, we create a new
  // trajectory that slides around the obstacle.
  let testNum: number;
  for (testNum = 0; testNum < 9 && movementRemaining > 0; testNum++) {
    logger.startSegment({ movementRemaining, slideFactor, pos, target });
    // The new trajectory after hitting an edge.
    let hitEdge: InsetEdge | undefined;
    let hitPos: Vector | undefined;
    let hitSlideFactor: number | undefined;
    let hitTarget: Vector | undefined;
    let hitFrac: number | undefined;
    for (const edge of insetEdges) {
      const test = logger.addTest(edge);
      if (edge.sliding) {
        // We are already sliding along this edge.
        test.write('A: Already sliding.');
        continue;
      }
      const { index } = edge.edge;
      const flag = index == 329 || index == 331;
      const { vertex0, vertex1 } = edge;
      // Inlined the line-line collision function here. See lineLineIntersection
      // in math.ts for a description of how this works.
      const denom = wedgeSubtract(pos, target, vertex0, vertex1);
      if (denom <= 0) {
        // We are going from the back side to the front side of the edge, or
        // parallel to the edge. This should not register a collision, so we can
        // escape if we get stuck on the back side of an edge. This should
        // happen often due to rounding error.
        test.write('B: wrong direction');
        continue;
      }
      const num1 = wedgeSubtract(vertex0, pos, vertex1, vertex0);
      const num2 = wedgeSubtract(vertex0, pos, target, pos);
      if (denom <= num1) {
        // We don't reach the edge.
        test.write('C. Did not reach');
        continue;
      }
      if (num2 < 0 || denom < num2) {
        // We pass by the edge to the right (num2 < 0) or left (denom < num2).
        test.write('D. Miss left/right');
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
        test.write('E. behind us');
        continue;
      }
      if (hitFrac != null && testFrac <= hitFrac) {
        // A previous test collided sooner.
        test.write('F. earlier collision exists (${testFrac} <= ${hitFrac})');
        continue;
      }
      test.write('G. collided');
      edge.edge.debugColor = testNum + 1;
      // At this point, we have a positive collision.
      hitEdge = edge;
      // Position on edge, with vertex0..vertex1 as 0..1.
      const edgeFrac = num2 / denom;
      hitPos = lerp(vertex0, vertex1, edgeFrac);
      // Factor to multiply movement by due to sliding.
      hitSlideFactor = dotSubtract(vertex1, vertex0, movement);
      test.write('collision info', {
        vertex0,
        vertex1,
        edgeFrac,
        hitPos,
        hitSlideFactor,
        num1,
        num2,
        denom,
      });
      if (
        !hitSlideFactor ||
        (slideFactor && Math.sign(slideFactor) != Math.sign(hitSlideFactor))
      ) {
        // The edge is perpendicular to our path (!newSlideFactor) or we are
        // wedged in a corner (slideFactor changes sign).
        hitTarget = hitPos;
        hitFrac = 0;
        test.write('H. in a corner');
      } else {
        hitFrac = testFrac;
        // Sliding along edge will add <v1-v0,m>/||v1-v0||^2 to the position.
        const edgeDeltaFrac =
          (testFrac * hitSlideFactor) / distanceSquared(vertex1, vertex0);
        let newEdgeFrac = edgeFrac + edgeDeltaFrac;
        if (newEdgeFrac <= 0) {
          hitTarget = vertex0;
          test.write('I. reaches vertex 0');
        } else if (newEdgeFrac >= 1) {
          hitTarget = vertex1;
          test.write('J. reaches vertex 1');
        } else {
          hitTarget = lerp(vertex0, vertex1, newEdgeFrac);
          test.write('K. in middle', { newEdgeFrac });
        }
      }
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
    hitEdge.sliding = true;
    pos = hitPos;
    slideFactor = hitSlideFactor;
    target = hitTarget;
    movementRemaining *= hitFrac;
  }
  const dist2 = distanceSquared(madd(start, movement, 0.5), target);
  const maxDist2 = lengthSquared(movement) * 0.5;
  if (dist2 > maxDist2 * 1.01) {
    if (prevLogger) {
      prevLogger.dump();
    }
    logger.dump();
    throw new AssertionError(
      `bad walk: distance ${Math.sqrt(dist2)} > ${Math.sqrt(maxDist2)})`,
    );
  }
  prevLogger = logger;
  return pos;
}
