import { gl, canvas, getMousePos } from '../lib/global';
import { AssertionError, isDebug } from '../debug/debug';
import { uiShader, UiAttrib } from './shaders';
import { quad, packColor } from './util';
import { roundUpPow2 } from '../lib/util';
import { Vector, vector } from '../lib/math';
import { levelTime } from '../game/time';
import {
  playerHealth,
  playerHealthMax,
  playerMana,
  playerManaMax,
} from '../game/player';

/** If true, we are drawing the HUD. */
let hudMode: boolean | undefined;

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
  lines?: string[];
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
  // ctx.clearRect(0, 0, textureSize.x, textureSize.y);
}

function getFont(item: PositionedMenuItem): string {
  return `${(item.size * 32) | 0}px Luminari`;
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  let line = words.shift()!;
  if (!line) {
    return [];
  }
  const lines: string[] = [];
  for (const word of words) {
    const candidate = line + ' ' + word;
    if (ctx.measureText(candidate).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines;
}

/** Update the texture with the contents of the canvas. */
function updateTexture(): void {
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
}

/** Update the vertex buffer data. */
function updateBuffers(
  pos: Float32Array,
  color: Uint32Array,
  tex: Float32Array,
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, color, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, tex, gl.STATIC_DRAW);
}

/** Update the menu graphics data. */
function updateMenu(): void {
  if (!currentMenu) {
    throw new AssertionError('currentMenu == null');
  }
  const items = currentMenu.items;
  initContext();

  const baseLineHeight = 40;
  const textureMargin = 8;

  // Calculate the positions of the menu items.
  let fixspace = 0;
  let flexspace = 0;
  let itemcount = 0;
  for (const item of items) {
    flexspace += item.flexspace;
    if (item.text) {
      ctx.font = getFont(item);
      itemcount++;
      item.lines = wrapText(item.text, canvasSize.x * 0.95);
      fixspace += baseLineHeight * item.size * item.lines.length;
    }
    fixspace += item.space;
  }
  let flexamt = canvasSize.y - fixspace;
  let ypos = 0;
  let vpos = 0;
  if (flexspace) {
    flexamt /= flexspace;
  } else {
    ypos += flexamt / 2;
  }
  for (const item of items) {
    item.y0 = (ypos | 0) - textureMargin;
    item.v0 = vpos | 0;
    if (item.lines) {
      const delta = baseLineHeight * item.size * item.lines.length;
      ypos += delta;
      vpos += delta + textureMargin * 2;
    }
    ypos += item.space + flexamt * item.flexspace;
    item.y1 = (ypos | 0) + textureMargin;
    item.v1 = vpos | 0;
  }

  elementCount = itemcount * 6;
  const pos = new Float32Array(elementCount * 2);
  const color = new Uint32Array(elementCount);
  const tex = new Float32Array(elementCount * 2);
  let off = 0;

  for (const item of items) {
    if (!item.lines) {
      continue;
    }

    const lineHeight = baseLineHeight * item.size;
    ctx.save();
    ctx.translate(canvasSize.x / 2, item.v0 + lineHeight * 0.5 + textureMargin);
    ctx.font = getFont(item);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fff';
    // ctx.lineWidth = 6;
    // ctx.lineJoin = 'round';
    // ctx.strokeText(item.text, 0, 0);
    // ctx.fillRect(-150, -2, 300, 4);
    for (const line of item.lines) {
      ctx.fillText(line, 0, 0);
      ctx.translate(0, lineHeight);
    }
    ctx.restore();

    for (const [i, x, y] of quad) {
      pos.set([x * canvasSize.x, y ? item.y1 : item.y0], (off + i) * 2);
      tex.set([x * canvasSize.x, y ? item.v1 : item.v0], (off + i) * 2);
    }
    color.fill(
      packColor(Math.random(), Math.random(), Math.random()),
      off,
      off + 6,
    );

    off += 6;
  }

  updateTexture();
  updateBuffers(pos, color, tex);
}

function drawStatusBars(): void {
  const barWidth = 125;
  const barHeight = 8;

  const colors = '047 0ac 7dd 800 c00 f66 aaa'.split(' ');
  const color = () => '#' + colors.pop();

  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(150, 16 + 32 * i);

    ctx.beginPath();
    ctx.moveTo(barWidth - barHeight, barHeight);
    ctx.lineTo(barWidth, -barHeight);
    ctx.lineTo(-barWidth, -barHeight);
    ctx.lineTo(-barWidth + barHeight, barHeight);
    ctx.closePath();

    if (!i) {
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = color();
      ctx.stroke();
      ctx.fill();
    } else {
      ctx.fill();

      ctx.globalCompositeOperation = 'source-atop';

      ctx.save();
      const gradient = ctx.createRadialGradient(0, -3, 1, 0, 0, barHeight);

      gradient.addColorStop(0, color());
      gradient.addColorStop(0.3, color());
      gradient.addColorStop(1, color());
      ctx.fillStyle = gradient;
      const scale = 20;
      ctx.scale(scale, 1);
      ctx.fillRect(
        -barWidth / scale,
        -barHeight,
        (barWidth * 2) / scale,
        barHeight * 2,
      );
      ctx.restore();

      ctx.lineWidth = 2;
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#000';
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Update the in-game UI. */
export function startHUD(): void {
  hudMode = true;
  initContext();
  drawStatusBars();
  updateTexture();
}

/** Set the buffer to draw the full UI texture. */
function drawFullTexture() {
  elementCount = 6;
  const pos = new Float32Array(elementCount * 2);
  const color = new Uint32Array(elementCount);
  const tex = new Float32Array(elementCount * 2);

  for (const [i, x, y] of quad) {
    pos.set([x * canvasSize.x, y * canvasSize.x], i * 2);
    tex.set([x * canvasSize.x, y * canvasSize.x], i * 2);
  }
  color.fill(-1);
  updateBuffers(pos, color, tex);
}

/** Update the hud data. */
function updateHUD(): void {
  const maxSize = 4 * 6;
  const pos = new Float32Array(maxSize * 2);
  const color = new Uint32Array(maxSize);
  const tex = new Float32Array(maxSize * 2);
  let off = 0;
  function put(
    u0: number,
    v0: number,
    x0: number,
    y0: number,
    w: number,
    h: number,
  ): void {
    for (const [i, x, y] of quad) {
      pos.set([x0 + x * w, y0 + y * h], (off + i) * 2);
      tex.set([u0 + x * w, v0 + y * h], (off + i) * 2);
    }
    off += 6;
  }
  color.fill(-1);
  if (playerHealthMax) {
    const health = playerHealth / playerHealthMax;
    const off = playerManaMax ? 0 : 200;
    put(0, 0, 50 + off, 0, 300, 32);
    put(0, 32, 50 + off, 0, health < 1 ? 25 + 250 * health : 300, 32);
  }
  if (playerManaMax) {
    const mana = playerMana / playerManaMax;
    const d = mana < 1 ? 275 - 250 * mana : 0;
    put(0, 0, 450, 0, 300, 32);
    put(0 + d, 64, 450 + d, 0, 300 - d, 32);
  }
  elementCount = off;
  updateBuffers(pos, color, tex);
}

/**
 * Render the menu.
 */
export function renderUI(): void {
  const p = uiShader;
  if (isDebug && !p.program) {
    return;
  }

  if (hudMode) {
    updateHUD();
  }

  if (!elementCount) {
    return;
  }

  gl.useProgram(p.program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // Attributes
  gl.enableVertexAttribArray(UiAttrib.Pos);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.vertexAttribPointer(UiAttrib.Pos, 2, gl.FLOAT, false, 0, 0);

  gl.enableVertexAttribArray(UiAttrib.Color);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.vertexAttribPointer(UiAttrib.Color, 4, gl.UNSIGNED_BYTE, true, 0, 0);

  gl.enableVertexAttribArray(UiAttrib.TexCoord);
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.vertexAttribPointer(UiAttrib.TexCoord, 2, gl.FLOAT, false, 0, 0);

  // Textures
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Uniforms
  gl.uniform4f(
    p.Scale,
    2 / canvasSize.x,
    -2 / canvasSize.y,
    1 / textureSize.x,
    1 / textureSize.y,
  );
  gl.uniform1i(p.Texture, 0);

  // Draw
  gl.drawArrays(gl.TRIANGLES, 0, elementCount);

  // Cleanup
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(UiAttrib.Pos);
  gl.disableVertexAttribArray(UiAttrib.Color);
  gl.disableVertexAttribArray(UiAttrib.TexCoord);
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
  hudMode = false;
  currentMenu = null;
  canvas.addEventListener('click', menuClick);
}

/** Stop displaying any menu. */
export function endMenu(): void {
  elementCount = 0;
  canvas.removeEventListener('click', menuClick);
}
