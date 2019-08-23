/**
 * Level geometry renderer.
 */

import { cameraMatrix } from './camera';
import { gl } from './global';
import { Vector } from './math';
import { level } from './world';
import { Random } from './random';
import { clamp } from './util';
import { compileShader, compileProgram } from './shader';

const vshader = compileShader(
  gl.VERTEX_SHADER,
  `
attribute vec2 aPos;
attribute vec4 aColor;
varying vec4 Color;
uniform mat4 ModelViewProjection;
void main() {
    Color = aColor;
    gl_Position = ModelViewProjection * vec4(aPos, 0.0, 1.0);
}
  `,
);

const fshader = compileShader(
  gl.FRAGMENT_SHADER,
  `
precision lowp float;
varying vec4 Color;
void main() {
    gl_FragColor = Color;
}
  `,
);

const prog = compileProgram(['aPos', 'aColor'], vshader, fshader);

const indexBuf = gl.createBuffer()!; // FIXME: check?
const posBuf = gl.createBuffer()!;
const colorBuf = gl.createBuffer()!;
let elementCount: number | undefined;

interface TypedArray extends ArrayLike<number> {
  set(array: ArrayLike<number>, offset?: number): void;
}

function concatArrays<T extends TypedArray>(
  constructor: new (length: number) => T,
  arrays: readonly T[],
): T {
  let n = 0;
  for (const arr of arrays) {
    n += arr.length;
  }
  const r = new constructor(n);
  let i = 0;
  for (const arr of arrays) {
    r.set(arr, i);
    i += arr.length;
  }
  console.log('length:', i);
  return r;
}

/**
 * Create the level geometry.
 */
function createGeometry(): void {
  const cellIndexList: Uint16Array[] = [];
  const cellPosList: Float32Array[] = [];
  const cellColorList: Uint8Array[] = [];
  const random = new Random(9876);
  let index = 0;
  for (const cell of level.cells.values()) {
    if (cell.index < 0) {
      // Border cell.
      continue;
    }
    const vertexes: Readonly<Vector>[] = [];
    for (const edge of cell.edges()) {
      vertexes.push(edge.vertex0);
    }
    const n = vertexes.length;
    const cellIndex = new Uint16Array((n - 2) * 3);
    const cellPos = new Float32Array(n * 2);
    const cellColor = new Uint8Array(n * 4);
    for (let i = 0; i < n - 2; i++) {
      cellIndex[i * 3] = index + 0;
      cellIndex[i * 3 + 1] = index + i + 1;
      cellIndex[i * 3 + 2] = index + i + 2;
    }
    index += n;
    for (let i = 0; i < n; i++) {
      cellPos[i * 2] = vertexes[i].x;
      cellPos[i * 2 + 1] = vertexes[i].y;
    }
    const luminance =
      random.range(0.2, 0.4) + ((cell.walkable as unknown) as number) * 0.6;
    const val = clamp((luminance * 256) | 0, 0, 255);
    for (let i = 0; i < n; i++) {
      cellColor.set([val, val, val, 255], i * 4);
    }
    cellIndexList.push(cellIndex);
    cellPosList.push(cellPos);
    cellColorList.push(cellColor);
  }
  const indexData = concatArrays(Uint16Array, cellIndexList);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    concatArrays(Float32Array, cellPosList),
    gl.STATIC_DRAW,
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    concatArrays(Uint8Array, cellColorList),
    gl.STATIC_DRAW,
  );
  elementCount = indexData.length;
}

createGeometry();

/**
 * Render the level geometry.
 */
export function renderLevel(): void {
  if (!elementCount) {
    return;
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
  gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 0, 0);

  const mvp = gl.getUniformLocation(prog, 'ModelViewProjection');

  gl.useProgram(prog);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.uniformMatrix4fv(mvp, false, cameraMatrix);
  gl.drawElements(gl.TRIANGLES, elementCount, gl.UNSIGNED_SHORT, 0);
}
