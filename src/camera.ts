/**
 * The camere.
 */

import { canvas } from './global';

// Matrix layout
//
// [ 0  4  8 12 ]
// [ 1  5  9 13 ]
// [ 2  6 10 14 ]
// [ 3  7 11 15 ]
//
// m_ij = m[i+j*4]

/** The view projection matrix. */
export const cameraMatrix = new Float32Array(16);

/** A scratch matrix for multiplication. */
const scratchMatrix = new Float32Array(16);

/** Matrix to be multiplied into the camera matrix. */
const componentMatrix = new Float32Array(16);

/** Computes cameraMatrix *= componentMatrix. */
function matrixMultiply(): void {
  let i, j, k, s;
  // out_ij = a_ik * b_kj
  for (j = 0; j < 4; j++) {
    for (i = 0; i < 4; i++) {
      s = 0;
      for (k = 0; k < 4; k++) {
        s += cameraMatrix[i + k * 4] * componentMatrix[k + j * 4];
      }
      scratchMatrix[i + j * 4] = s;
    }
  }
  cameraMatrix.set(scratchMatrix);
}

/** Axes we can rotate the camera around. */
const enum Axis {
  X,
  Z,
}

/**
 * Set componentMatrix to be the identity.
 */
function identity(): void {
  componentMatrix.fill(0);
  componentMatrix[0] = 1;
  componentMatrix[5] = 1;
  componentMatrix[10] = 1;
  componentMatrix[15] = 1;
}

/**
 * Multiply cameraMatrix by a rotation matrix.
 * @param axis Axis to rotate around.
 * @param angle Angle to rotate.
 */
function rotate(axis: Axis, angle: number) {
  const [c1, c2, s1, s2] = axis ? [0, 5, 1, 4] : [5, 10, 6, 9];
  identity();
  componentMatrix[c1] = componentMatrix[c2] = Math.cos(angle);
  componentMatrix[s1] = -(componentMatrix[s2] = Math.sin(angle));
  matrixMultiply();
}

/**
 * Update the camera.
 */
export function updateCamera(): void {
  // Set up projection matrix.
  //
  // zNear: near Z clip plane
  // zFar: far Z clip plane
  // mx: slope of X clip planes, mx = tan(fovX / 2)
  // my: slope of Y clip planes, my = tan(fovY / 2)
  //
  // [ 1 / mx, 0, 0, 0 ]
  // [ 0, 1 / my, 0, 0 ]
  // [ 0, 0, -(far + near) / (far - near), -2 * far * near / (far - near) ]
  // [ 0, 0, -1, 0 ]
  const zNear = 0.1,
    zFar = 20;
  const mx = 0.7,
    my = (mx * canvas.clientHeight) / canvas.clientWidth;
  cameraMatrix.fill(0);
  cameraMatrix[0] = 0.5 / mx;
  cameraMatrix[5] = 0.5 / my;
  cameraMatrix[10] = (zNear + zFar) / (zNear - zFar);
  cameraMatrix[11] = -1;
  cameraMatrix[14] = (2 * zNear * zFar) / (zNear - zFar);

  // Rotate.
  rotate(Axis.X, Math.PI * 0.25);
  rotate(Axis.Z, Math.PI * 0.25);

  // Transpose.
  identity();
  componentMatrix.set([-2, 2, -2], 12);
  matrixMultiply();
}
