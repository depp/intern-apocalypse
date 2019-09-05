/**
 * Create normals for a model.
 * @param pos Vertex position data, size 3 per vertex.
 * @param index Index array data for triangles.
 */
export function createNormals(
  pos: Float32Array,
  index: Uint16Array,
): Float32Array {
  const normals = new Float32Array(pos.length);
  const vectors = [new Float32Array(3), new Float32Array(3)];
  const normal = new Float32Array(3);
  for (let i = 0; i < index.length; i += 3) {
    for (let j = 0; j < 2; j++) {
      const i0 = 3 * index[i];
      const i1 = 3 * index[i + 1 + j];
      for (let k = 0; k < 3; k++) {
        vectors[j][k] = pos[i1 + k] - pos[i0 + k];
      }
    }
    for (let j = 0; j < 3; j++) {
      normal[j] =
        vectors[0][(j + 1) % 3] * vectors[1][(j + 2) % 3] -
        vectors[0][(j + 2) % 3] * vectors[1][(j + 1) % 3];
    }
    for (let j = 0; j < 3; j++) {
      const i0 = 3 * index[i + j];
      for (let k = 0; k < 3; k++) {
        normals[i0 + k] += normal[k];
      }
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    let m = 0;
    for (let j = 0; j < 3; j++) {
      m += normals[i + j] ** 2;
    }
    if (m > 0) {
      const a = 1 / Math.sqrt(m);
      for (let j = 0; j < 3; j++) {
        normals[i + j] *= a;
      }
    }
  }
  return normals;
}
