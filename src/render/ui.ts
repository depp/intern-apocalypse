import { gl } from '../lib/global';
import { AssertionError, isDebug } from '../debug/debug';
import { flat as flatShader, flat, Attribute } from './shaders';
import { quad } from './util';
import { uiMatrix } from '../game/camera';
import { identityMatrix } from '../lib/matrix';
import { roundUpPow2 } from '../lib/util';
import { Vector, vector } from '../lib/math';

let hasTitle = false;
let offscreenCanvas!: HTMLCanvasElement;
let canvasSize!: Vector;
let textureSize!: Vector;
let ctx!: CanvasRenderingContext2D;

const texture = gl.createTexture();
const posBuffer = gl.createBuffer();
const texBuffer = gl.createBuffer();

/** Initialize the drawing context. Must be called before drawing operations. */
function initContext(): void {
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
    ctx = offscreenCanvas.getContext('2d')!;
    if (!ctx) {
      throw new AssertionError('ctx == null');
    }
  }
  canvasSize = vector(gl.drawingBufferWidth, gl.drawingBufferHeight);
  textureSize = vector(roundUpPow2(canvasSize.x), roundUpPow2(canvasSize.y));
  offscreenCanvas.width = textureSize.x;
  offscreenCanvas.height = textureSize.y;
}

function makeTitle(): void {
  initContext();

  const text = 'Internship\nat the\nApocalypse';
  // Luminari, Palatino, URW Palladio, Palatino Linotype
  ctx.font = 'bold 48px Luminari';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, canvasSize.x / 2, canvasSize.y / 2);
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, canvasSize.x / 2, canvasSize.y / 2);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    offscreenCanvas,
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);

  const pos = new Float32Array(6 * 2);
  const tex = new Float32Array(6 * 2);
  const aspect = canvasSize.x / canvasSize.y;
  const u1 = canvasSize.x / textureSize.x;
  const v1 = canvasSize.y / textureSize.y;
  for (const [i, x, y, u, v] of quad) {
    pos.set([x * aspect, y], i * 2);
    tex.set([u * u1, v * v1], i * 2);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, tex, gl.STATIC_DRAW);

  hasTitle = true;
}

/**
 * Render the menu.
 */
export function renderUI(): void {
  const p = flatShader;
  if (isDebug && !p.program) {
    return;
  }

  if (!hasTitle) {
    makeTitle();
  }

  gl.useProgram(p.program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // Attributes
  gl.enableVertexAttribArray(Attribute.Pos);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.vertexAttribPointer(Attribute.Pos, 2, gl.FLOAT, false, 0, 0);

  gl.vertexAttrib4f(Attribute.Color, 1, 1, 1, 1);

  gl.enableVertexAttribArray(Attribute.TexCoord);
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.vertexAttribPointer(Attribute.TexCoord, 2, gl.FLOAT, false, 0, 0);

  // Textures
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Uniforms
  gl.uniformMatrix4fv(p.ViewProjection, false, uiMatrix);
  gl.uniformMatrix4fv(p.Model, false, identityMatrix);
  gl.uniform1i(p.Texture, 0);

  // Draw
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Cleanup
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(Attribute.Pos);
  gl.disableVertexAttribArray(Attribute.TexCoord);
  gl.bindTexture(gl.TEXTURE_2D, null);
}
