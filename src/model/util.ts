/**
 * 3D vector library, especially designed for working with model data.
 */

/** A 3D vector. */
export type Vector3 = Float32Array & { _brand: 'Vector3' };

/** Create a new 3D vector. */
export function newVector3(): Vector3 {
  return new Float32Array(3) as Vector3;
}

/** Compute out = u - v. */
export function subVector3(out: Vector3, u: Vector3, v: Vector3): void {
  for (let i = 0; i < 3; i++) {
    out[i] = u[i] - v[i];
  }
}

/** Get a 3D vector from a model data array. */
export function getVector3(
  out: Vector3,
  data: Float32Array,
  index: number,
): void {
  out.set(data.subarray(index * 3, index * 3 + 3));
}

/** Set a 3D vector in a model data array. */
export function putVector3(
  vector: Vector3,
  data: Float32Array,
  index: number,
): void {
  data.set(vector, index * 3);
}

/**
 * Compute the cross product of two vectors.
 * @param out Output vector.
 * @param u Left input vector.
 * @param v Right input vector.
 */
export function crossVector3(out: Vector3, u: Vector3, v: Vector3): void {
  for (let i = 0; i < 3; i++) {
    out[i] = u[(i + 1) % 3] * v[(i + 2) % 3] - u[(i + 2) % 3] * v[(i + 1) % 3];
  }
}
