/**
 * Global settings.
 */

/** Settings for debug view. */
export const debugView = {
  level: false,
  centroids: false,
  player: false,
};

/** Settings for the camera. */
export const cameraSettings = {
  /** Camera distance from player, in meters. */
  distance: 10,
  /** Camera elevation, as a slope. */
  elevation: 1,
  /** Zoom. This is proportional to the lens focal length. */
  zoom: 2,
  /** Near Z clip plane distance. */
  zNear: 0.1,
  /** Far Z clip plane distance. */
  zFar: 20,
  /** Camera movement speed (filtering). */
  speed: 8,
};

/** Settings for the player. */
export const playerSettings = {
  /** Player movement speed, in meters per second. */
  speed: 5,
  /** Player turning speed, in radians per second. */
  turnSpeed: 20,
};
