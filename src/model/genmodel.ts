import { quad, packColor } from '../render/util';
import { AssertionError, isDebug } from '../debug/debug';
import { gl } from '../lib/global';
import {
  newVector3,
  subVector3,
  crossVector3,
  Vector3,
  getVector3,
} from './util';

/** Maximum number of vertexes. */
const maxVertexCount = 2048;
/** Maximum number of indexes. */
const maxIndexCount = 2048;

/**
 * General model type. Used for any shader.
 */
export interface GenModel {
  /** Position vertex data. */
  pos: WebGLBuffer | null;
  /** Color vertex data. */
  color: WebGLBuffer | null;
  /** Texture coordinate data. */
  tex: WebGLBuffer | null;
  /** Vertex normals. */
  normal: WebGLBuffer | null;
  /** Index array. */
  index: WebGLBuffer | null;
  /** Number of elements in vertex array. */
  vcount: number;
  /** Number of elements in index array. */
  icount: number;
}

/** Create a new, empty model. */
export function newModel(): GenModel {
  return {
    pos: null,
    color: null,
    tex: null,
    normal: null,
    index: null,
    vcount: 0,
    icount: 0,
  };
}

const posData = new Float32Array(maxVertexCount * 3);
const colorData = new Uint32Array(maxVertexCount);
const texData = new Float32Array(maxVertexCount * 2);
const normalData = new Float32Array(maxVertexCount * 3);
const indexData = new Uint16Array(maxIndexCount);

const enum Mode {
  None,
  /** 2D mode with no index array. */
  Mode2D = 2,
  /** 3D mode with an index array. */
  Mode3D = 3,
}

let mode = Mode.None;
let vertex = 0;
let index = 0;
let color = 0;

/** Start creating a new 2D mobel. */
export function start2D(): void {
  mode = Mode.Mode2D;
  vertex = 0;
  index = 0;
  color = -1;
}

/** Start creating a new mobel. */
export function start3D(): void {
  mode = Mode.Mode3D;
  vertex = 0;
  index = 0;
  color = -1;
  normalData.fill(0);
}

/** Upload the model data to WebGL. */
export function upload(m: GenModel, usage: number = 0): void {
  usage = usage || gl.STATIC_DRAW;
  gl.bindBuffer(gl.ARRAY_BUFFER, m.pos || (m.pos = gl.createBuffer()));
  gl.bufferData(gl.ARRAY_BUFFER, posData.subarray(0, vertex * mode), usage);
  gl.bindBuffer(gl.ARRAY_BUFFER, m.color || (m.color = gl.createBuffer()));
  gl.bufferData(gl.ARRAY_BUFFER, colorData.subarray(0, vertex), usage);
  gl.bindBuffer(gl.ARRAY_BUFFER, m.tex || (m.tex = gl.createBuffer()));
  gl.bufferData(gl.ARRAY_BUFFER, texData.subarray(0, vertex * 2), usage);
  if (mode == Mode.Mode3D) {
    createNormals();
    gl.bindBuffer(gl.ARRAY_BUFFER, m.normal || (m.normal = gl.createBuffer()));
    gl.bufferData(gl.ARRAY_BUFFER, normalData.subarray(0, vertex * 3), usage);
    gl.bindBuffer(
      gl.ELEMENT_ARRAY_BUFFER,
      m.index || (m.index = gl.createBuffer()),
    );
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData.subarray(0, index), usage);
  }
  m.vcount = vertex;
  m.icount = index;
  if (isDebug) {
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
}

/** Destroy a model and free its buffers. */
export function destroy(m: GenModel): void {
  gl.deleteBuffer(m.pos);
  gl.deleteBuffer(m.color);
  gl.deleteBuffer(m.tex);
  gl.deleteBuffer(m.normal);
  gl.deleteBuffer(m.index);
  Object.assign(m, newModel());
}

export function enableAttr(...attr: number[]): void {
  if (isDebug) {
    for (let i = 0; i < attr.length; i++) {
      for (let j = i + 1; j < attr.length; j++) {
        if (attr[i] == attr[j]) {
          throw new AssertionError('duplicate attr', { attr });
        }
      }
    }
  }
  for (const index of attr) {
    gl.enableVertexAttribArray(index);
  }
}

export function disableAttr(...attr: number[]): void {
  for (const index of attr) {
    gl.disableVertexAttribArray(index);
  }
}

export function bind2D(
  m: GenModel,
  posAttr: number,
  colorAttr: number,
  texAttr: number,
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, m.pos);
  gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, m.color);
  gl.vertexAttribPointer(colorAttr, 4, gl.UNSIGNED_BYTE, true, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, m.tex);
  gl.vertexAttribPointer(texAttr, 2, gl.FLOAT, false, 0, 0);
}

export function bind3D(
  m: GenModel,
  posAttr: number,
  colorAttr: number,
  texAttr: number,
  normalAttr: number,
): void {
  if (posAttr >= 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pos);
    gl.vertexAttribPointer(posAttr, 3, gl.FLOAT, false, 0, 0);
  }

  if (colorAttr >= 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.color);
    gl.vertexAttribPointer(colorAttr, 4, gl.UNSIGNED_BYTE, true, 0, 0);
  }

  if (texAttr >= 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.tex);
    gl.vertexAttribPointer(texAttr, 2, gl.FLOAT, false, 0, 0);
  }

  if (normalAttr >= 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.normal);
    gl.vertexAttribPointer(normalAttr, 3, gl.FLOAT, false, 0, 0);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.index);
}

/**
 * Write a 2D quad to the model.
 * @param u Texture U coordinate, texels.
 * @param v Texture V coordinate, texels.
 * @param x Screen X coordinate, pixels.
 * @param y Screen Y coordinate, pixels.
 * @param w Width, pixels.
 * @param h Width, pixels.
 * @param xanchor X anchor position, 0-1.
 * @param yanchor Y anchor position, 0-1.
 */
export function addQuad(
  u: number,
  v: number,
  x: number,
  y: number,
  w: number,
  h: number,
  xanchor: number = 0,
  yanchor: number = 0,
): void {
  if (6 > maxVertexCount - vertex) {
    throw new AssertionError('model overflow');
  }
  if (mode != Mode.Mode2D) {
    throw new AssertionError('wrong mode');
  }
  for (const [i, qx, qy] of quad) {
    posData.set(
      [x + (qx - xanchor) * w, y + (qy - yanchor) * h],
      (vertex + i) * 2,
    );
    texData.set(
      [u + (qx - xanchor) * w, v + (qy - yanchor) * h],
      (vertex + i) * 2,
    );
  }
  colorData.fill(color, vertex, vertex + 6);
  vertex += 6;
}

/** Set the current vertex color to a random color. */
export function setRandomColor(): void {
  color = packColor(Math.random(), Math.random(), Math.random());
}

/** Set the vertex color for future vertexes. */
export function setColor(newColor: number) {
  color = newColor;
}

let faceVertex!: number;

/** Start a new face with any number of sides. */
export function startFace(): void {
  if (mode != Mode.Mode3D) {
    throw new AssertionError('wrong mode');
  }
  faceVertex = vertex;
}

/** Vertex winding order for faces. */
export const enum Winding {
  CCW,
  CW,
}

const triangleVertexes = [newVector3(), newVector3(), newVector3()];

/** End a face, and emit the triangles. */
export function endFace(winding: Winding): void {
  if (faceVertex < 0) {
    throw new AssertionError('no face to end');
  }
  const size = vertex - faceVertex;
  if (size < 3) {
    throw new AssertionError('degenerate face');
  }
  const [v0, v1, v2] = triangleVertexes;
  for (let i = 1; i < size - 1; i++) {
    const indexes = [
      faceVertex,
      faceVertex + i + winding,
      faceVertex + i + ((!winding as unknown) as number),
    ];
    indexData.set(indexes, index);
    index += 3;
    // Calculate normal and area.
    indexes.forEach((i, j) => getVector3(triangleVertexes[j], posData, i));
    subVector3(v1, v1, v0);
    subVector3(v2, v2, v0);
    crossVector3(v0, v1, v2);
    indexes.forEach(i => {
      for (let j = 0; j < 3; j++) {
        normalData[i * 3 + j] += v0[j];
      }
    });
  }
  if (isDebug) {
    faceVertex = -1;
  }
}

/** Add a single vertex to the 3D model. */
export function addVertex(position: ArrayLike<number>): void {
  posData.set(position, vertex * 3);
  colorData[vertex] = color;
  vertex++;
}

/** Get triangle data from an indexed data array. */
export function getTriangle(out: Vector3[], offset: number): void {
  for (let i = 0; i < 3; i++) {
    const index = indexData[offset + i];
    out[i].set(posData.subarray(index * 3, index * 3 + 3));
  }
}

/**
 * Create normals for the model.
 */
function createNormals(): void {
  for (let i = 0; i < vertex; i++) {
    let m = 0;
    for (let j = 0; j < 3; j++) {
      m += normalData[i * 3 + j] ** 2;
    }
    if (m > 0) {
      const a = 1 / Math.sqrt(m);
      for (let j = 0; j < 3; j++) {
        normalData[i * 3 + j] *= a;
      }
    }
  }
}
