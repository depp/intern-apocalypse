import { newVector3, getVector3, subVector3, crossVector3 } from './util';

/**
 * Create normals for a model.
 * @param posData Vertex position data, size 3 per vertex.
 * @param indexData Index array data for triangles.
 */
export function createNormals(
  posData: Float32Array,
  indexData: Uint16Array,
): Float32Array {
  const normalData = new Float32Array(posData.length);
  const vectors = [newVector3(), newVector3(), newVector3()];
  const [v0, v1, v2] = vectors;
  for (let offset = 0; offset < indexData.length; offset += 3) {
    for (let j = 0; j < 3; j++) {
      getVector3(vectors[j], posData, indexData[offset + j]);
    }
    subVector3(v1, v1, v0);
    subVector3(v2, v2, v0);
    crossVector3(v0, v1, v2);
    for (let j = 0; j < 3; j++) {
      const i0 = 3 * indexData[offset + j];
      for (let k = 0; k < 3; k++) {
        normalData[i0 + k] += v0[k];
      }
    }
  }
  for (let i = 0; i < normalData.length; i += 3) {
    let m = 0;
    for (let j = 0; j < 3; j++) {
      m += normalData[i + j] ** 2;
    }
    if (m > 0) {
      const a = 1 / Math.sqrt(m);
      for (let j = 0; j < 3; j++) {
        normalData[i + j] *= a;
      }
    }
  }
  return normalData;
}
