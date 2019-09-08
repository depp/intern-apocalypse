import { gl, canvas, getMousePos } from '../lib/global';
import { AssertionError, isDebug } from '../debug/debug';
import { flatShader, FlatAttrib } from './shaders';
import { quad, packColor } from './util';
import { uiMatrix } from '../game/camera';
import { identityMatrix } from '../lib/matrix';
import { roundUpPow2 } from '../lib/util';
import { Vector, vector, lerp1D } from '../lib/math';

export interface Menu {
  click?(): void;
}

export interface MenuItem {
  text?: string;
  size?: number;
  flexspace?: number;
  space?: number;
  click?(): void;
}

/** A menu which has been positioned and rendered. */
interface PositionedMenu extends Menu {
  items: PositionedMenuItem[];
  next: PositionedMenu | undefined | null;
}

/** A menu item which has been positioned. */
interface PositionedMenuItem extends MenuItem {
  size: number;
  flexspace: number;
  space: number;
  y0: number;
  y1: number;
  v0: number;
  v1: number;
}

let currentMenu: PositionedMenu | undefined | null;

let offscreenCanvas!: HTMLCanvasElement;
let canvasSize!: Vector;
let textureSize!: Vector;
let ctx!: CanvasRenderingContext2D;

let texture: WebGLTexture | null;
let posBuffer: WebGLBuffer | null;
let colorBuffer: WebGLBuffer | null;
let texBuffer: WebGLBuffer | null;
let elementCount: number | undefined;

/** Initialize the UI renderer. */
export function initRenderUI(): void {
  texture = gl.createTexture();
  posBuffer = gl.createBuffer();
  colorBuffer = gl.createBuffer();
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
  if (!currentMenu) {
    throw new AssertionError('currentMenu == null');
  }
  const items = currentMenu.items;
  initContext();

  // Calculate the positions of the menu items.
  let fixspace = 0;
  let flexspace = 0;
  let itemcount = 0;
  for (const item of items) {
    flexspace += item.flexspace;
    if (item.text) {
      itemcount++;
      fixspace += 48 * item.size;
    }
    fixspace += item.space;
  }
  const flexamt = flexspace && (canvasSize.y - fixspace) / flexspace;
  let ypos = 0;
  let vpos = 0;
  for (const item of items) {
    item.y0 = ypos | 0;
    item.v0 = vpos | 0;
    if (item.text) {
      ypos += 48 * item.size;
      vpos += 48 * item.size;
    }
    ypos += item.space + flexamt * item.flexspace;
    item.y1 = ypos | 0;
    item.v1 = vpos | 0;
  }

  elementCount = itemcount * 6;
  const pos = new Float32Array(elementCount * 2);
  const color = new Int32Array(elementCount);
  const tex = new Float32Array(elementCount * 2);
  const aspect = canvasSize.x / canvasSize.y;
  const usize = canvasSize.x / textureSize.x;
  const vsize = canvasSize.y / textureSize.y;
  let off = 0;

  for (const item of items) {
    if (!item.text) {
      continue;
    }

    ctx.save();
    ctx.translate(canvasSize.x / 2, (item.v0 + item.v1) / 2);
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

    for (const [i, x, , u, v] of quad) {
      pos.set(
        [x * aspect, 1 - (2 * lerp1D(item.y0, item.y1, v)) / canvasSize.y],
        (off + i) * 2,
      );
      tex.set(
        [u * usize, (lerp1D(item.v0, item.v1, v) / canvasSize.y) * vsize],
        (off + i) * 2,
      );
    }
    color.fill(
      packColor(Math.random(), Math.random(), Math.random()),
      off,
      off + 6,
    );

    off += 6;
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
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, color, gl.STATIC_DRAW);
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
  gl.enableVertexAttribArray(FlatAttrib.Pos);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.vertexAttribPointer(FlatAttrib.Pos, 2, gl.FLOAT, false, 0, 0);

  gl.enableVertexAttribArray(FlatAttrib.Color);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.vertexAttribPointer(FlatAttrib.Color, 4, gl.UNSIGNED_BYTE, true, 0, 0);

  gl.enableVertexAttribArray(FlatAttrib.TexCoord);
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.vertexAttribPointer(FlatAttrib.TexCoord, 2, gl.FLOAT, false, 0, 0);

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
  gl.disableVertexAttribArray(FlatAttrib.Pos);
  gl.disableVertexAttribArray(FlatAttrib.Color);
  gl.disableVertexAttribArray(FlatAttrib.TexCoord);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

/**
 * Handle a mouse click on the canvas.
 */
function menuClick(event: MouseEvent) {
  event.preventDefault();
  if (currentMenu == null) {
    throw new AssertionError('no menu');
  }
  if (currentMenu.click) {
    currentMenu.click();
  }
  const { y } = getMousePos(event);
  for (const item of currentMenu.items) {
    if (item.click && item.y0 <= y && y < item.y1) {
      item.click();
    }
  }
}

/** Push a new menu to the top of the stack. */
export function pushMenu(menu: Menu, ...menuItems: MenuItem[]): void {
  currentMenu = Object.assign(
    {
      items: menuItems.map(item =>
        Object.assign(
          {
            size: 1,
            flexspace: 0,
            space: 0,
            y0: 0,
            y1: 0,
            v0: 0,
            v1: 0,
          },
          item,
        ),
      ),
      next: currentMenu,
    },
    menu,
  );
  updateMenu();
}

/** Pop the current menu off the top of the stack. */
export function popMenu(): void {
  if (currentMenu == null) {
    throw new AssertionError('currentMenu == null');
  }
  currentMenu = currentMenu.next;
  updateMenu();
}

/** Start displaying menus. A menu must be pushed afterwards. */
export function startMenu(): void {
  currentMenu = null;
  canvas.addEventListener('click', menuClick);
}

/** Stop displaying any menu. */
export function endMenu(): void {
  elementCount = 0;
  canvas.removeEventListener('click', menuClick);
}
