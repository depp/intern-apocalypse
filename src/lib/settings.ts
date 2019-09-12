/**
 * Global settings.
 */

/** Settings for debug view. */
export const debugView = {
  /** Game slowdown factor. */
  slowDown: 1,
  level: false,
  centroids: false,
  entities: false,
  coordinates: false,
};

/** Settings for the camera. */
export const cameraSettings = {
  /** Camera distance from player, in meters. */
  distance: 15,
  /** Camera elevation, as a slope. */
  elevation: 1,
  /** Zoom. This is proportional to the lens focal length. */
  zoom: 2,
  /** Near Z clip plane distance. */
  zNear: 5,
  /** Far Z clip plane distance. */
  zFar: 40,
  /** Camera movement speed (filtering). */
  speed: 8,
  /** Maximum distance from level edge. */
  border: 13,
};

/** Settings for the player. */
export const playerSettings = {
  /** Player movement speed, in meters per second. */
  speed: 5,
  /** Player acceleration, in meters per second. */
  acceleration: 20,
  /** Player turning speed, in radians per second. */
  turnSpeed: 20,
  /** Amount of time an attack lasts. */
  attackTime: 0.25,
};
