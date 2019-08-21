/**
 * Math types and functions.
 */

/** 2D vector. */
export interface Vector {
  x: number;
  y: number;
}

/** Create a vector. */
export function vector(x: number, y: number): Vector {
  return { x, y };
}

/** Return the squared Euclidean distance between two vectors. */
export function distanceSquared(
  u: Readonly<Vector>,
  v: Readonly<Vector>,
): number {
  return (u.x - v.x) ** 2 + (u.y - v.y) ** 2;
}

/** Return the Euclidean distance between two vectors. */
export function distance(u: Readonly<Vector>, v: Readonly<Vector>): number {
  return Math.sqrt(distanceSquared(u, v));
}

/** Compute the dot product of subtracted vectors, <u-v, a-b>. */
export function dotSubtract(
  u: Vector,
  v: Vector,
  a: Vector,
  b: Vector,
): number {
  return (u.x - v.x) * (a.x - b.x) + (u.y - v.y) * (a.y - b.y);
}

/** Compute the wedge product of subtracted vectors, (u-v) ^ (a-b). */
export function wedgeSubtract(
  u: Vector,
  v: Vector,
  a: Vector,
  b: Vector,
): number {
  return (u.x - v.x) * (a.y - b.y) - (u.y - v.y) * (a.x - b.x);
}

/**
 * Linearly interpolate between two vectors.
 *
 * If alpha is not in the range 0-1, then this will produce vectors outside the
 * segment between u and v. The result will not be clamped.
 */
export function lerp(
  u: Readonly<Vector>,
  v: Readonly<Vector>,
  alpha: number,
): Vector {
  return {
    x: u.x + alpha * (v.x - u.x),
    y: u.y + alpha * (v.y - u.y),
  };
}

/**
 * Calculate the fraction at which to divide a line into two parts based on
 * which center the points are closer to.
 *
 * @param v1 A point on the line.
 * @param v2 A different point on the line.
 * @param c1 A center point off the line.
 * @param c2 A different center point off the line.
 * @return The fraction from v1 to v2 wher the split between points closer to c1
 * and points closer to c2.
 */
export function findLineSplit(
  v1: Readonly<Vector>,
  v2: Readonly<Vector>,
  c1: Readonly<Vector>,
  c2: Readonly<Vector>,
): number {
  // || v1 + alpha (v2 - v1) - c1 ||^2 = || v1 + alpha (v2 - v1) - c2 ||^2
  //
  // || v1 - c1 ||^2 - || v1 - c2||^2
  //     = -2 alpha <v1 - c1, v2 - v1> + 2 alpha <v1 - c2, v2 - v1>
  //     = 2 alpha <c1 - c2, v2 -v1>
  return (
    (0.5 * (distanceSquared(v1, c1) - distanceSquared(v1, c2))) /
    dotSubtract(c2, c1, v1, v2)
  );
}

/**
 * Test if a line segment intersects a circle.
 * @param v1 One end of the line segment.
 * @param v2 The other end of the line segment.
 * @param c Center of the circle.
 * @param radiusSquared Radius of the circle, squared.
 */
export function lineIntersectsCircle(
  v1: Readonly<Vector>,
  v2: Readonly<Vector>,
  c: Readonly<Vector>,
  radiusSquared: number,
): boolean {
  if (
    distanceSquared(v1, c) <= radiusSquared ||
    distanceSquared(v2, c) <= radiusSquared
  ) {
    return true;
  }
  const lengthSquared = distanceSquared(v1, v2);
  const dot = dotSubtract(v1, v2, c, v2);
  return (
    0 <= dot &&
    dot <= lengthSquared &&
    wedgeSubtract(v1, v2, c, v2) ** 2 <= radiusSquared * lengthSquared
  );
}
