/**
 * Math types and functions.
 */

/** 2D vector. */
export interface Vector {
  x: number;
  y: number;
}

/** Return the squared Euclidean distance between two vectors. */
export function distanceSquared(
  u: Readonly<Vector>,
  v: Readonly<Vector>,
): number {
  return (u.x - v.x) ** 2 + (u.y - v.y) ** 2;
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
    ((c2.x - c1.x) * (v1.x - v2.x) + (c2.y - c1.y) * (v1.y - v2.y))
  );
}
