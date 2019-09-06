/**
 * 4x4 matrix types and functions.
 */

// Matrix layout
//
// [ 0  4  8 12 ]
// [ 1  5  9 13 ]
// [ 2  6 10 14 ]
// [ 3  7 11 15 ]
//
// m_ij = m[i+j*4]

/** A 4x4 matrix. */
export type Matrix = Float32Array & { _brand: 'Matrix' };

/** Create a new 4x4 matrix. */
export function matrixNew(): Matrix {
  return new Float32Array(16) as Matrix;
}

/** A scratch matrix for multiplication. */
const scratchMatrix = matrixNew();
/** A second scratch matrix for other operations. */
const scratchMatrix2 = matrixNew();

/** Compute out = a * b. Aliasing is permitted. */
export function matrixMultiply(out: Matrix, a: Matrix, b: Matrix): void {
  let i, j, k, s;
  // out_ij = a_ik * b_kj
  for (j = 0; j < 4; j++) {
    for (i = 0; i < 4; i++) {
      s = 0;
      for (k = 0; k < 4; k++) {
        s += a[i + k * 4] * b[k + j * 4];
      }
      scratchMatrix[i + j * 4] = s;
    }
  }
  out.set(scratchMatrix);
}

/** Set a matrix to the identity matrix. */
export function setIdentityMatrix(out: Matrix) {
  out.fill(0);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
}

/** Axes we can rotate the around. */
export const enum Axis {
  X,
  Y,
  Z,
}

/**
 * Right-multiply a matrix by a rotation matrix using a direction rather than
 * angles.
 * @param out Output matrix.
 * @param axis Axis to rotate around.
 * @param u Second axis component (the axis after the main axis).
 * @param v Third axis component (the axis before the main axis).
 */
export function rotateMatrixFromDirection(
  out: Matrix,
  axis: Axis,
  u: number,
  v: number,
) {
  const [c1, c2, s1, s2] =
    axis == Axis.Z ? [0, 5, 1, 4] : axis ? [0, 10, 8, 2] : [5, 10, 6, 9];
  const a = 1 / Math.hypot(u, v);
  setIdentityMatrix(scratchMatrix2);
  scratchMatrix2[c1] = scratchMatrix2[c2] = a * u;
  scratchMatrix2[s2] = -(scratchMatrix2[s1] = a * v);
  matrixMultiply(out, out, scratchMatrix2);
}

/**
 * Right-multiply a matrix by a rotation matrix.
 * @param out Output matrix.
 * @param axis Axis to rotate around.
 * @param angle Angle to rotate.
 */
export function rotateMatrixFromAngle(out: Matrix, axis: Axis, angle: number) {
  rotateMatrixFromDirection(out, axis, Math.cos(angle), Math.sin(angle));
}

/**
 * Right-multiply a matrix by a translation matrix.
 * @param out Output matrix.
 * @param value Vector to translate by.
 */
export function translateMatrix(out: Matrix, value: ArrayLike<number>): void {
  setIdentityMatrix(scratchMatrix2);
  scratchMatrix2.set(value, 12);
  matrixMultiply(out, out, scratchMatrix2);
}

/**
 * Right-multiply a matrix by a scaling matrix.
 * @param out Output matrix.
 * @param scale The X, Y, Z scaling parameters.
 */
export function scaleMatrix(out: Matrix, scale: number[]): void {
  setIdentityMatrix(scratchMatrix2);
  for (let i = 0; i < scale.length; i++) {
    scratchMatrix2[i * 5] = scale[i];
  }
  matrixMultiply(out, out, scratchMatrix2);
}
