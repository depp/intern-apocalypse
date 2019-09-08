import { pointCount } from './points';
import { lengthVector3, Vector3, newVector3 } from './util';
import { globalRandom } from '../lib/random';
import { gl } from '../lib/global';

/**
 * Create a WebGL buffer with random vec4 values.
 *
 * The xyz value is uniformly selected inside the unit sphere.
 *
 * The w value is uniformly selected in the range [0, 1].
 */
export function makeRandom(): WebGLBuffer | null {
  const randomData = new Float32Array(pointCount * 4);
  const vec = newVector3();
  for (let i = 0; i < pointCount; i++) {
    do {
      for (let j = 0; j < 3; j++) {
        vec[j] = globalRandom.range(-1, 1);
      }
    } while (lengthVector3(vec as Vector3) > 1);
    randomData.set(vec, i * 4);
    randomData[i * 4 + 3] = globalRandom.range();
  }
  const randomBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, randomBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, randomData, gl.STATIC_DRAW);
  return randomBuffer;
}
