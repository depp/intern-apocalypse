/**
 * The camere.
 */

import { cameraSettings } from '../debug/controls';
import { canvas } from '../lib/global';
import {
  matrixMultiply,
  Axis,
  rotationMatrixFromDirection,
  translationMatrix,
} from '../lib/matrix';
import { playerPos } from './player';

/** The view projection matrix. */
export const cameraMatrix = new Float32Array(16);

/** Matrix to be multiplied into the camera matrix. */
const componentMatrix = new Float32Array(16);

/**
 * Update the camera.
 */
export function updateCamera(): void {
  const { distance, elevation, zoom, zNear, zFar } = cameraSettings;
  // Set up projection matrix.
  //
  // zNear: near Z clip plane
  // zFar: far Z clip plane
  // mx: slope of X clip planes, mx = 1 / tan(fovX / 2)
  // my: slope of Y clip planes, my = 1 / tan(fovY / 2)
  //
  // [ mx, 0, 0, 0 ]
  // [ 0, my, 0, 0 ]
  // [ 0, 0, -(far + near) / (far - near), -2 * far * near / (far - near) ]
  // [ 0, 0, -1, 0 ]
  cameraMatrix.fill(0);
  cameraMatrix[0] = zoom;
  cameraMatrix[5] = (zoom * canvas.clientWidth) / canvas.clientHeight;
  cameraMatrix[10] = (zNear + zFar) / (zNear - zFar);
  cameraMatrix[11] = -1;
  cameraMatrix[14] = (2 * zNear * zFar) / (zNear - zFar);

  // Adjust the camera location to show an equal amount of space in front of and
  // behind the player. Without this adjustment, the player can't see as far
  // in front, and traveling in that direction is more difficult (monsters would
  // sneak up on you from that direction).
  //
  // Math notes: Solved with law of sines, then rewritten to remove
  // trigonometry. The 'max' puts a limit on the adjustment, which otherwise
  // diverges as the camera angle is adjusted towards the horizon.
  const mf = zoom * elevation;
  const num = Math.hypot(elevation, 1) * mf;
  const adjust = num / Math.max(mf ** 2 - 1, num);

  const a = 1 / Math.hypot(elevation, 1);
  // Rotate.
  rotationMatrixFromDirection(componentMatrix, Axis.X, elevation, 1);
  matrixMultiply(cameraMatrix, cameraMatrix, componentMatrix);

  // Transpose.
  translationMatrix(componentMatrix, [
    -playerPos.x,
    distance * a - playerPos.y + adjust,
    -distance * a * elevation - 0.5,
  ]);
  matrixMultiply(cameraMatrix, cameraMatrix, componentMatrix);
}
