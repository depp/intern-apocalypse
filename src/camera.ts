/**
 * The camere.
 */

import { cameraSettings } from './debug.controls';
import { canvas } from './global';
import {
  matrixMultiply,
  Axis,
  rotationMatrix,
  translationMatrix,
} from './matrix';
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
  cameraMatrix[0] = 0.5 * zoom;
  cameraMatrix[5] = (0.5 * zoom * canvas.clientWidth) / canvas.clientHeight;
  cameraMatrix[10] = (zNear + zFar) / (zNear - zFar);
  cameraMatrix[11] = -1;
  cameraMatrix[14] = (2 * zNear * zFar) / (zNear - zFar);

  // Rotate.
  rotationMatrix(componentMatrix, Axis.X, Math.PI * 0.5 - elevation);
  matrixMultiply(cameraMatrix, cameraMatrix, componentMatrix);

  // Transpose.
  translationMatrix(componentMatrix, [
    -playerPos.x,
    distance * Math.cos(elevation) - playerPos.y,
    -distance * Math.sin(elevation),
  ]);
  matrixMultiply(cameraMatrix, cameraMatrix, componentMatrix);
}
