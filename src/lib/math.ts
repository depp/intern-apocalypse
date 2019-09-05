/**
 * Math types and functions.
 */

/** 1D linear interpolation: compute u+a*(v-u). */
export function lerp1D(u: number, v: number, a: number): number {
  return u + a * (v - u);
}

/** 2D vector. */
export interface Vector {
  x: number;
  y: number;
}

/** Create a vector. */
export function vector(x: number, y: number): Vector {
  return { x, y };
}

/** The zero vector. */
export const zeroVector = vector(0, 0);

/** Multiply a vector by a scalar. */
export function scaleVector(u: Readonly<Vector>, scale: number): Vector {
  return vector(u.x * scale, u.y * scale);
}

/** Compute the length of a vector, squared. */
export function lengthSquared(u: Readonly<Vector>): number {
  return u.x ** 2 + u.y ** 2;
}

/** Compute the length of a vector, squared. */
export function length(u: Readonly<Vector>): number {
  return Math.hypot(u.x, u.y);
}

/** Compute u+v*a. */
export function madd(
  u: Readonly<Vector>,
  v: Readonly<Vector>,
  a: number = 1,
): Vector {
  return vector(u.x + v.x * a, u.y + v.y * a);
}

/** Compute u+(v0-v1)*a. */
export function maddSubtract(
  u: Readonly<Vector>,
  v0: Readonly<Vector>,
  v1: Readonly<Vector>,
  a: number = 1,
): Vector {
  return vector(u.x + (v0.x - v1.x) * a, u.y + (v0.y - v1.y) * a);
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
  b: Vector = zeroVector,
): number {
  return (u.x - v.x) * (a.x - b.x) + (u.y - v.y) * (a.y - b.y);
}

/** Compute the wedge product of subtracted vectors, (u-v) ^ (a-b). */
export function wedgeSubtract(
  u: Vector,
  v: Vector,
  a: Vector,
  b: Vector = zeroVector,
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

/** Compute the normal vector for an oriented line. */
export function lineNormal(v0: Readonly<Vector>, v1: Readonly<Vector>) {
  const x = v0.y - v1.y,
    y = v1.x - v0.x,
    a = 1 / Math.hypot(x, y);
  return vector(x * a, y * a);
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

/**
 * Calculate the point of intersection of two oriented line segments if they are
 * not collinear and line 1 passes from the front to the back of line 2.
 * @param v0 First end of line segment 1.
 * @param v1 Second end of line segment 1.
 * @param v2 First end of line segment 2.
 * @param v3 Second end of line segment 2.
 * @returns If the line segments intersect, the fraction along line segment 1
 * that the intersection occurs, in the range 0..1. Otherwise, or if the line
 * segments are collinear, or if the line passes in the wrong direction, -1.
 */
export function lineLineIntersection(
  v0: Readonly<Vector>,
  v1: Readonly<Vector>,
  v2: Readonly<Vector>,
  v3: Readonly<Vector>,
): number {
  // Let alpha = fraction along line 1, beta = fraction along line 2.
  // alpha = (v0-v2) ^ (v3-v2) / (v3-v2) ^ (v1-v0)
  // beta  = (v2-v0) ^ (v1-v0) / (v1-v0) ^ (v3-v2)
  // The wedge products have been rearranged a bit.
  const denom = wedgeSubtract(v0, v1, v2, v3);
  if (denom <= 0) {
    // Parallel or cross in the wrong direction.
    return -1;
  }
  const num1 = wedgeSubtract(v2, v0, v3, v2);
  if (num1 < 0 || denom < num1) {
    return -1;
  }
  const num2 = wedgeSubtract(v2, v0, v1, v0);
  if (num2 < 0 || denom < num2) {
    return -1;
  }
  return num1 / denom;
}

/**
 * Project a point onto a circle.
 */
export function projectToCircle(
  v: Readonly<Vector>,
  center: Readonly<Vector>,
  radius: number,
): Vector {
  const dx = v.x - center.x,
    dy = v.y - center.y,
    a = radius / Math.hypot(dx, dy);
  return vector(center.x + dx * a, center.y + dy * a);
}
