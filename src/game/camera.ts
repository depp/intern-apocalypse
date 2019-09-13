/**
 * The camere.
 */

import { cameraSettings } from '../lib/settings';
import { canvas } from '../lib/global';
import {
  Axis,
  rotateMatrixFromDirection,
  translateMatrix,
  matrixNew,
  rotateMatrixFromAngle,
} from '../lib/matrix';
import { Vector, vector, zeroVector, lerp } from '../lib/math';
import { frameDT } from './time';
import { globalRandom } from '../lib/random';
import { currentLevel } from './campaign';
import { clamp } from '../lib/util';

/** The view projection matrix for the UI. */
export const uiMatrix = matrixNew();

/** The current camera target and filter coefficients. */
let cameraTargetFilter = [zeroVector, zeroVector, zeroVector];

export function getCameraTarget(): Vector {
  return cameraTargetFilter[2];
}

/** Set the current target of the camera. */
export function setCameraTarget(target: Vector): void {
  const bound = currentLevel.level.size - cameraSettings.border;
  cameraTargetFilter[0] = vector(
    clamp(target.x, -bound, bound),
    clamp(target.y, -bound, bound),
  );
}

/** The view projection matrix. */
export const cameraMatrix = matrixNew();

let cameraShake0 = new Float32Array(6);
let cameraShake1 = new Float32Array(6);

export function applyCameraShake(amount: number): void {
  for (let i = 0; i < 6; i++) {
    cameraShake1[i] += globalRandom.range(-amount, amount);
  }
}

/**
 * Update the camera.
 */
export function updateCamera(): void {
  // Set up orthographic projection matrix.
  uiMatrix.fill(0);
  uiMatrix[0] = canvas.clientHeight / canvas.clientWidth;
  uiMatrix[5] = 1;
  uiMatrix[10] = 1;
  uiMatrix[15] = 1;

  // Update the camera position.
  const smoothRatio = Math.exp(-cameraSettings.speed * frameDT);
  for (let i = 0; i < 2; i++) {
    cameraTargetFilter[i + 1] = lerp(
      cameraTargetFilter[i],
      cameraTargetFilter[i + 1],
      smoothRatio,
    );
  }

  // Update the camera shake.
  [cameraShake0, cameraShake1] = [cameraShake1, cameraShake0];
  for (let i = 0; i < 6; i++) {
    cameraShake0[i] =
      0.05 ** frameDT * (1.7 * cameraShake1[i] - 0.8 * cameraShake0[i]);
  }

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

  // Set distance.
  translateMatrix(cameraMatrix, [0, 0, -cameraSettings.distance]);

  // Rotate.
  rotateMatrixFromDirection(cameraMatrix, Axis.X, elevation, -1);
  for (let axis = 0; axis < 3; axis++) {
    rotateMatrixFromAngle(cameraMatrix, axis, cameraShake0[axis] * 0.3);
  }

  // Set target.
  const { x, y } = cameraTargetFilter[2];
  translateMatrix(cameraMatrix, [-x, -y + adjust, -0.5]);
  translateMatrix(cameraMatrix, cameraShake0.slice(3));
}
