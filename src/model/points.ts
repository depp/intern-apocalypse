import {
  newVector3,
  getTriangle,
  subVector3,
  crossVector3,
  lengthVector3,
  lerpVector3,
  putVector3,
} from './util';
import { globalRandom } from '../lib/random';
import { gl } from '../lib/global';

/** Point cloud data generated from a model. */
export interface ModelPoints {
  /** Point position data. */
  pos: WebGLBuffer | null;
  /** Point color data. */
  color: WebGLBuffer | null;
  /** Number of points. */
  count: number;
}

/**
 * Number of points to generate in point clouds.
 */
export const pointCount = 1024;

/** Create a point cloud from a model. */
export function makePoints(
  posData: Float32Array,
  colorData: Uint32Array,
  indexData: Uint16Array,
): ModelPoints {
  const cumulativeWeight: number[] = [];
  const vectors = [newVector3(), newVector3(), newVector3()];
  const [v0, v1, v2] = vectors;
  let weight = 0;
  for (let offset = 0; offset < indexData.length; offset += 3) {
    getTriangle(vectors, posData, indexData, offset);
    subVector3(v1, v1, v0);
    subVector3(v2, v2, v0);
    crossVector3(v0, v1, v2);
    cumulativeWeight.push((weight += lengthVector3(v0)));
  }
  const pointPosData = new Float32Array(pointCount * 3);
  const pointColorData = new Uint32Array(pointCount);
  for (let i = 0; i < pointCount; i++) {
    const pos = globalRandom.range() * weight;
    let triangle = 0;
    while (
      triangle < cumulativeWeight.length &&
      cumulativeWeight[triangle] < pos
    ) {
      triangle++;
    }
    getTriangle(vectors, posData, indexData, triangle * 3);
    const u = globalRandom.range();
    const v = globalRandom.range();
    lerpVector3(v0, v0, v1, u + v > 1 ? 1 - u : u);
    lerpVector3(v0, v0, v2, u + v > 1 ? 1 - v : v);
    putVector3(v0, pointPosData, i);
    pointColorData[i] =
      colorData[indexData[triangle * 3 + globalRandom.rangeInt(3)]];
  }
  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pointPosData, gl.STATIC_DRAW);
  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pointColorData, gl.STATIC_DRAW);
  return {
    pos: posBuffer,
    color: colorBuffer,
    count: pointCount,
  };
}
