/**
 * Level geometry renderer.
 */

import { cameraMatrix } from '../game/camera';
import { gl } from '../lib/global';
import { level } from '../game/world';
import { Random } from '../lib/random';
import { clamp } from '../lib/util';
import { levelShader, LevelAttrib } from './shaders';
import { Edge } from '../game/level';
import { concatArrays } from '../lib/array';
import { AssertionError } from '../debug/debug';

let indexBuf!: WebGLBuffer | null;
let posBuf!: WebGLBuffer | null;
let colorBuf!: WebGLBuffer | null;
let elementCount: number | undefined;

const random = new Random(9876);

function flatColor(n: number, walkable: boolean): Uint8Array {
  const array = new Uint8Array(n * 4);
  const luminance =
    random.range(0.2, 0.4) + ((walkable as unknown) as number) * 0.6;
  const val = clamp((luminance * 256) | 0, 0, 255);
  for (let i = 0; i < n; i++) {
    array.set([val, val, val, 255], i * 4);
  }
  return array;
}

/**
 * Create the level geometry.
 */
function createGeometry(): void {
  const cellIndexList: Uint16Array[] = [];
  const cellPosList: Float32Array[] = [];
  const cellColorList: Uint8Array[] = [];
  let index = 0;
  const wallHeight = 0.7;
  for (const cell of level.cells.values()) {
    if (cell.index < 0) {
      // Border cell.
      continue;
    }
    const z = ((!cell.walkable as unknown) as number) * wallHeight;
    const edges: Readonly<Edge>[] = Array.from(cell.edges());
    const n = edges.length;
    const cellIndex = new Uint16Array((n - 2) * 3);
    const cellPos = new Float32Array(n * 3);
    for (let i = 0; i < n - 2; i++) {
      cellIndex[i * 3] = index + 0;
      cellIndex[i * 3 + 1] = index + i + 1;
      cellIndex[i * 3 + 2] = index + i + 2;
    }
    index += n;
    for (let i = 0; i < n; i++) {
      const { x, y } = edges[i].vertex0;
      cellPos[i * 3] = x;
      cellPos[i * 3 + 1] = y;
      cellPos[i * 3 + 2] = z;
    }
    cellIndexList.push(cellIndex);
    cellPosList.push(cellPos);
    cellColorList.push(flatColor(n, cell.walkable));
    if (!cell.walkable) {
      for (const edge of edges) {
        const { back } = edge;
        if (!back) {
          throw new AssertionError('back == null');
        }
        if (back.cell!.walkable) {
          const { vertex0, vertex1 } = edge;
          cellIndexList.push(
            new Uint16Array([
              index + 0,
              index + 1,
              index + 2,
              index + 2,
              index + 1,
              index + 3,
            ]),
          );
          index += 4;
          cellPosList.push(
            new Float32Array([
              vertex0.x,
              vertex0.y,
              0,
              vertex1.x,
              vertex1.y,
              0,
              vertex0.x,
              vertex0.y,
              wallHeight,
              vertex1.x,
              vertex1.y,
              wallHeight,
            ]),
          );
          cellColorList.push(flatColor(4, cell.walkable));
        }
      }
    }
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

/** Initialize the level renderer. */
export function initRenderLevel(): void {
  indexBuf = gl.createBuffer();
  posBuf = gl.createBuffer();
  colorBuf = gl.createBuffer();
  createGeometry();
}

/**
 * Render the level geometry.
 */
export function renderLevel(): void {
  const p = levelShader;
  if (!p.program || !elementCount) {
    return;
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.vertexAttribPointer(LevelAttrib.Pos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
  gl.vertexAttribPointer(LevelAttrib.Color, 4, gl.UNSIGNED_BYTE, true, 0, 0);

  gl.useProgram(p.program);
  gl.enableVertexAttribArray(LevelAttrib.Pos);
  gl.enableVertexAttribArray(LevelAttrib.Color);
  gl.uniformMatrix4fv(p.ModelViewProjection, false, cameraMatrix);
  gl.drawElements(gl.TRIANGLES, elementCount, gl.UNSIGNED_SHORT, 0);

  gl.disableVertexAttribArray(LevelAttrib.Pos);
  gl.disableVertexAttribArray(LevelAttrib.Color);
}
