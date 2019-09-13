import {
  gl,
  canvas,
  getMousePos,
  setState,
  State,
  currentState,
} from '../lib/global';
import { AssertionError, isDebug } from '../debug/debug';
import { uiShader, UiAttrib } from './shaders';
import { roundUpPow2 } from '../lib/util';
import { Vector, vector } from '../lib/math';
import * as genmodel from '../model/genmodel';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';
import { campaignData } from '../game/campaign';

/** Modes that the UI system can run in. */
const enum UIMode {
  /** Draw nothing. */
  Clear,
  /** Draw a menu. */
  Menu,
  /** Draw in-game HUD. */
  HUD,
}

/** What is currently being drawn in the UI. */
let uiMode: UIMode | undefined;

export interface MenuItem {
  text?: string;
  size?: number;
  flexspace?: number;
  space?: number;
  outlined?: boolean;
  click?(): void;
}

/** A menu which has been positioned and rendered. */
interface Menu {
  items: PositionedMenuItem[];
  next: Menu | undefined | null;
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

let currentMenu: Menu | undefined | null;

let offscreenCanvas!: HTMLCanvasElement;
let canvasSize!: Vector;
let textureSize!: Vector;
let ctx!: CanvasRenderingContext2D;

let texture: WebGLTexture | null;
let gmodel = genmodel.newModel();

/** Initialize the UI renderer. */
export function initRenderUI(): void {
  texture = gl.createTexture();
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

/** Update the menu graphics data. */
function updateMenu(): void {
  if (!currentMenu) {
    throw new AssertionError('currentMenu == null');
  }
  const items = currentMenu.items;
  initContext();

  const baseLineHeight = 40;
  const textureMargin = 8;
  const boxMargin = 16;

  // Calculate the positions of the menu items.
  let fixspace = 0;
  let flexspace = 0;
  for (const item of items) {
    flexspace += item.flexspace;
    if (item.text) {
      ctx.font = getFont(item);
      item.lines = wrapText(item.text, canvasSize.x * 0.95);
      fixspace += baseLineHeight * item.size * item.lines.length;
      if (item.outlined) {
        fixspace += boxMargin * 2;
      }
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
      if (item.outlined) {
        ypos += boxMargin * 3;
        vpos += boxMargin * 3;
      }
    }
    ypos += item.space + flexamt * item.flexspace;
    item.y1 = (ypos | 0) + textureMargin;
    item.v1 = vpos | 0;
  }

  genmodel.start2D();

  for (const item of items) {
    if (!item.lines) {
      continue;
    }

    const lineHeight = baseLineHeight * item.size;
    ctx.save();
    ctx.translate(canvasSize.x / 2, item.v0 + textureMargin);
    if (item.outlined) {
      ctx.textAlign = 'left';
      ctx.rect(
        -(400 - 32),
        0,
        800 - 64,
        lineHeight * item.lines.length + boxMargin * 2,
      );
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.save();
      ctx.strokeStyle = '#666';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      ctx.translate(-(400 - 32) + boxMargin, boxMargin);
    } else {
      ctx.textAlign = 'center';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fff';
    }

    ctx.translate(0, lineHeight * 0.5);
    ctx.font = getFont(item);
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 4;
    for (const line of item.lines) {
      if (item.size > 1) {
        ctx.shadowColor = '#000';
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;
        ctx.fillText(line, 0, 0);
        ctx.shadowColor = 'transparent';
        ctx.strokeText(line, 0, 0);
      }
      ctx.fillText(line, 0, 0);
      ctx.translate(0, lineHeight);
    }
    ctx.restore();

    genmodel.setColor(-1);
    genmodel.addQuad(0, item.v0, 0, item.y0, canvasSize.x, item.y1 - item.y0);
  }

  updateTexture();
  genmodel.upload(gmodel);
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

/** Update the hud data. */
function updateHUD(): void {
  genmodel.start2D();
  if (campaignData.playerHealthMax) {
    const health = campaignData.playerHealth / campaignData.playerHealthMax;
    const off = 0 /* mana */ ? 0 : 200;
    genmodel.addQuad(0, 0, 50 + off, 0, 300, 32);
    genmodel.addQuad(
      0,
      32,
      50 + off,
      0,
      health < 1 ? 25 + 250 * health : 300,
      32,
    );
  }
  if (0 /* mana */) {
    const mana = 0 /* playerMana / playerManaMax */;
    const d = mana < 1 ? 275 - 250 * mana : 0;
    genmodel.addQuad(0, 0, 450, 0, 300, 32);
    genmodel.addQuad(0 + d, 64, 450 + d, 0, 300 - d, 32);
  }
  genmodel.upload(gmodel);
}

/**
 * Render the menu.
 */
export function renderUI(): void {
  const p = uiShader;
  if (isDebug && !p.program) {
    return;
  }

  if (!uiMode) {
    return;
  }
  if (uiMode == UIMode.HUD) {
    updateHUD();
  }

  gl.useProgram(p.program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // Attributes
  genmodel.enableAttr(UiAttrib.Pos, UiAttrib.Color, UiAttrib.TexCoord);
  genmodel.bind2D(gmodel, UiAttrib.Pos, UiAttrib.Color, UiAttrib.TexCoord);

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
  gl.drawArrays(gl.TRIANGLES, 0, gmodel.vcount);

  // Cleanup
  gl.disable(gl.BLEND);
  genmodel.disableAttr(UiAttrib.Pos, UiAttrib.Color, UiAttrib.TexCoord);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

/** Play the menu click sound. */
export function playClickSound(): void {
  playSound(Sounds.Click);
}

/**
 * Handle a mouse click on the canvas.
 */
function menuClick(event: MouseEvent) {
  event.preventDefault();
  if (currentMenu == null) {
    throw new AssertionError('no menu');
  }
  const { y } = getMousePos(event);
  for (const item of currentMenu.items) {
    if (item.click && item.y0 <= y && y < item.y1) {
      playClickSound();
      item.click();
    }
  }
}

/** Start showing the given menu. */
export function startMenu(...menuItems: MenuItem[]): void {
  uiMode = UIMode.Menu;
  currentMenu = null;
  canvas.addEventListener('click', menuClick);
  pushMenu(...menuItems);
}

/** Push a new menu to the top of the stack. */
export function pushMenu(...menuItems: MenuItem[]): void {
  if (uiMode != UIMode.Menu) {
    throw new AssertionError('incorrect mode', { uiMode });
  }
  currentMenu = {
    items: menuItems.map(item =>
      Object.assign(
        {
          size: 1,
          flexspace: 0,
          space: 0,
        } as PositionedMenuItem,
        item,
      ),
    ),
    next: currentMenu,
  };
  updateMenu();
}

/**
 * Pop the current menu off the top of the stack. Refuses to pop the last menu
 * off the stack, except if we are in GameMenu.
 */
export function popMenu(doClickSound?: boolean): void {
  if (currentMenu == null) {
    throw new AssertionError('currentMenu == null');
  }
  if (currentMenu.next) {
    currentMenu = currentMenu.next;
    updateMenu();
  } else if (currentState == State.GameMenu) {
    setState(State.Game);
  } else {
    return;
  }
  if (doClickSound) {
    playClickSound();
  }
}

function removeHandlers(): void {
  canvas.removeEventListener('click', menuClick);
}

/** Stop displaying any menu or HUD. */
export function clearUI(): void {
  uiMode = UIMode.Clear;
  removeHandlers();
}

/** Start displaying the in-game UI. */
export function startHUD(): void {
  uiMode = UIMode.HUD;
  removeHandlers();
  initContext();
  drawStatusBars();
  updateTexture();
}
