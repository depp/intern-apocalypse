/**
 * 3D model loading code.
 */

import { Opcode } from './defs';
import { gl } from '../lib/global';
import { AssertionError } from '../debug/debug';
import { dataMax, decodeExponential } from '../lib/data.encode';
import { clamp } from '../lib/util';

/** A loaded model. */
export interface Model {
  /** Position vertex data. */
  pos: WebGLBuffer | null;
  /** Color vertex data. */
  color: WebGLBuffer | null;
  /** Index array. */
  index: WebGLBuffer | null;
  /** Number of elements in index array. */
  count: number;
}

/*
const debugColors = [
  0x00000000,
  0x000000ff,
  0x0000ff00,
  0x0000ffff,
  0x00ff0000,
  0x00ff00ff,
  0x00ffff00,
  0x00ffffff,
  0x00000000,
  0x00000066,
  0x00006600,
  0x00006666,
  0x00660000,
  0x00660066,
  0x00666600,
  0x00666666,
];
*/

/** Load a model from a binary stream. */
export function loadModel(data: Uint8Array): Model {
  const maxSize = 1000;
  let pos = 7 + data[0] * 3;
  const scale = new Float32Array(data.slice(4, 7)).map(decodeExponential);
  const posData = new Float32Array(maxSize);
  const colorData = new Uint32Array(maxSize);
  const indexData = new Uint16Array(maxSize);
  let color = 0;
  let symmetry = 0;
  let pointIndex = 0;
  let indexPos = 0;
  while (pos < data.length) {
    switch (data[pos++]) {
      case Opcode.Symmetry:
        symmetry = data[pos++];
        break;
      case Opcode.Color:
        color = 0;
        for (let i = 0; i < 3; i++) {
          color |=
            clamp((data[pos++] * 256) / (dataMax + 1), 0, 255) << (i * 8);
        }
        break;
      default:
        let size = data[pos - 1] + (3 - Opcode.Face3);
        if (size < 3) {
          throw new AssertionError(`invalid model opcode: ${data[pos - 1]}`);
        }
        let faceSymmetry = symmetry;
        let savePos = pos;
        for (let reflection = 0; reflection < 8; reflection++) {
          if (reflection & ~faceSymmetry) {
            continue;
          }
          pos = savePos;
          let parity = (0b10010110 >> reflection) & 1;
          for (let i = 0; i < size - 2; i++) {
            indexData[indexPos++] = pointIndex;
            indexData[indexPos++] = pointIndex + i + 1 + parity;
            indexData[indexPos++] =
              pointIndex + i + 1 + ((!parity as any) as number);
          }
          for (let vertex = 0; vertex < size; vertex++) {
            let index = data[pos++];
            let flags = 0;
            if (index > dataMax - 8) {
              flags = index - (dataMax - 7);
              index = data[pos++];
            }
            if (index >= data[0]) {
              throw new AssertionError(`point out of range: ${index}`);
            }
            for (let axis = 0; axis < 3; axis++) {
              let value =
                scale[axis] * (data[7 + index * 3 + axis] - data[axis + 1]);
              if ((flags ^ reflection) & (1 << axis)) {
                value = -value;
              }
              posData[pointIndex * 3 + axis] = value;
            }
            // debugColors[pointIndex & 15]
            colorData[pointIndex++] = color;
            faceSymmetry &= ~flags;
          }
        }
        break;
    }
  }
  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    posData.subarray(0, pointIndex * 3),
    gl.STATIC_DRAW,
  );
  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    colorData.subarray(0, pointIndex),
    gl.STATIC_DRAW,
  );
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    indexData.subarray(0, indexPos),
    gl.STATIC_DRAW,
  );
  return {
    pos: posBuffer,
    color: colorBuffer,
    index: indexBuffer,
    count: indexPos,
  };
}

/** Unload a loaded model. */
export function unloadModel(model: Model): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  gl.deleteBuffer(model.pos);
  gl.deleteBuffer(model.color);
  gl.deleteBuffer(model.index);
}
