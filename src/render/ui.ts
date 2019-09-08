import { gl, canvas } from '../lib/global';
import { AssertionError, isDebug } from '../debug/debug';
import { flat as flatShader, flat, Attribute } from './shaders';
import { quad } from './util';
import { uiMatrix } from '../game/camera';
import { identityMatrix } from '../lib/matrix';
import { roundUpPow2 } from '../lib/util';
import { Vector, vector } from '../lib/math';

export interface Menu {
  click?(): void;
}

export interface MenuItem {
  text?: string;
  size?: number;
  flexspace?: number;
  marginTop?: number;
  marginBottom?: number;
}

/** A menu item which has been positioned. */
interface PositionedMenuItem {
  text?: string;
  size: number;
  flexspace: number;
  marginTop: number;
  marginBottom: number;
  y0: number;
  y1: number;
}

let currentMenu: Menu | undefined | null;
let currentItems: PositionedMenuItem[] | undefined | null;

let offscreenCanvas!: HTMLCanvasElement;
let canvasSize!: Vector;
let textureSize!: Vector;
let ctx!: CanvasRenderingContext2D;

let texture: WebGLTexture | null;
let posBuffer: WebGLBuffer | null;
let texBuffer: WebGLBuffer | null;
let elementCount: number | undefined;

/** Initialize the UI renderer. */
export function initRenderUI(): void {
  texture = gl.createTexture();
  posBuffer = gl.createBuffer();
  texBuffer = gl.createBuffer();
}

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

/** Update the menu graphics data. */
function updateMenu(): void {
  if (currentItems == null) {
    throw new AssertionError('currentMenu == null');
  }
  initContext();

  // Calculate the positions of the menu items.
  let fixspace = 0;
  let flexspace = 0;
  let itemcount = 0;
  for (const item of currentItems) {
    flexspace += item.flexspace;
    if (item.text) {
      itemcount++;
      fixspace += 48 * item.size;
    }
    fixspace += item.marginTop + item.marginBottom;
  }
  console.log('fixspace', fixspace, flexspace);
  const flexamt = flexspace && (canvasSize.y - fixspace) / flexspace;
  let y = 0;
  for (const item of currentItems) {
    y += item.marginTop;
    item.y0 = y | 0;
    if (item.text) {
      y += 48 * item.size;
    }
    y += flexamt * item.flexspace;
    item.y1 = y | 0;
    y += item.marginBottom;
  }

  elementCount = itemcount * 6;
  const pos = new Float32Array(elementCount * 2);
  const tex = new Float32Array(elementCount * 2);
  const aspect = canvasSize.x / canvasSize.y;
  const u1 = canvasSize.x / textureSize.x;
  const v1 = canvasSize.y / textureSize.y;
  let off = 0;

  for (const item of currentItems) {
    if (!item.text) {
      continue;
    }

    ctx.save();
    ctx.translate(canvasSize.x / 2, (item.y0 + item.y1) / 2);
    ctx.font = `bold ${item.size * 32}px Luminari`;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fff';
    // ctx.lineWidth = 6;
    // ctx.lineJoin = 'round';
    // ctx.strokeText(item.text, 0, 0);
    // ctx.fillRect(-150, -2, 300, 4);
    ctx.fillText(item.text, 0, 0);
    ctx.restore();

    for (const [i, x, y, u, v] of quad) {
      pos.set([x * aspect, y], off + i * 2);
      tex.set([u * u1, v * v1], off + i * 2);
    }

    off += 12;
  }

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

  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, tex, gl.STATIC_DRAW);
}

/**
 * Render the menu.
 */
export function renderUI(): void {
  const p = flatShader;
  if (isDebug && !p.program) {
    return;
  }

  if (!elementCount) {
    return;
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
  gl.drawArrays(gl.TRIANGLES, 0, elementCount);

  // Cleanup
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(Attribute.Pos);
  gl.disableVertexAttribArray(Attribute.TexCoord);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

/**
 * Handle a mouse click on the canvas.
 */
function menuClick(event: MouseEvent) {
  event.preventDefault();
  if (currentMenu == null || currentItems == null) {
    throw new AssertionError('no menu');
  }
  if (currentMenu.click) {
    currentMenu.click();
  }
}

/**
 * Start displaying a menu.
 */
export function startMenu(menu: Menu, ...items: MenuItem[]): void {
  currentMenu = menu;
  currentItems = [];
  for (const item of items) {
    currentItems.push(
      Object.assign(
        {
          size: 1,
          flexspace: 0,
          marginTop: 0,
          marginBottom: 0,
          y0: 0,
          y1: 0,
        },
        item,
      ),
    );
  }
  updateMenu();
  canvas.addEventListener('click', menuClick);
}

/**
 * Stop displaying any menu.
 */
export function endMenu(): void {
  elementCount = 0;
  canvas.removeEventListener('click', menuClick);
}
