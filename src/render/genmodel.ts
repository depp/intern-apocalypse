import { quad, packColor } from './util';
import { AssertionError, isDebug } from '../debug/debug';
import { gl } from '../lib/global';

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

let posData = new Float32Array(maxVertexCount * 3);
let colorData = new Uint32Array(maxVertexCount);
let texData = new Float32Array(maxVertexCount * 2);
let normalData = new Float32Array(maxVertexCount * 3);
let indexData = new Uint16Array(maxIndexCount);

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
}

/** Upload the model data to WebGL. */
export function upload(m: GenModel, usage: number = 0): void {
  usage = usage || gl.STATIC_DRAW;
  gl.bindBuffer(gl.ARRAY_BUFFER, m.pos || (m.pos = gl.createBuffer()));
  gl.bufferData(gl.ARRAY_BUFFER, posData /* .subarray(vertex * mode)*/, usage);
  gl.bindBuffer(gl.ARRAY_BUFFER, m.color || (m.color = gl.createBuffer()));
  gl.bufferData(gl.ARRAY_BUFFER, colorData /*.subarray(vertex)*/, usage);
  gl.bindBuffer(gl.ARRAY_BUFFER, m.tex || (m.tex = gl.createBuffer()));
  gl.bufferData(gl.ARRAY_BUFFER, texData /*.subarray(vertex * 2)*/, usage);
  if (mode == Mode.Mode3D) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.normal || (m.normal = gl.createBuffer()));
    gl.bufferData(gl.ARRAY_BUFFER, normalData.subarray(vertex * 3), usage);
    gl.bindBuffer(
      gl.ELEMENT_ARRAY_BUFFER,
      m.index || (m.index = gl.createBuffer()),
    );
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData.subarray(index), usage);
  }
  m.vcount = vertex;
  m.icount = index;
  if (isDebug) {
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
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
