/**
 * Debug renderer. Draws the game using simple 2D graphics.
 */

import { frameDT } from './time';

let canvas!: HTMLCanvasElement;
let ctx!: CanvasRenderingContext2D;

/**
 * Initilaize the debug drawing context.
 */
function initContext(): void {
  if (ctx == null) {
    if (canvas == null) {
      // Create new DOM elements.
      const div = document.createElement('div');
      div.setAttribute('id', 'container');
      const canvas3D = document.getElementById('g');
      if (!canvas3D) {
        throw new Error('missing canvas3D');
      }
      canvas = document.createElement('canvas');
      canvas.setAttribute('id', 'debugcanvas');
      canvas.width = 800;
      canvas.height = 600;
      // Reorganize so both canvases are children of the div.
      canvas3D.replaceWith(div);
      div.appendChild(canvas3D);
      div.appendChild(canvas);
    }
    const context = canvas.getContext('2d');
    if (context == null) {
      throw new Error('could not create canvas 2D context');
    }
    ctx = context;
  }
}

/**
 * Render the debug info.
 */
export function renderDebug(): void {
  initContext();
  ctx.clearRect(0, 0, 800, 600);
  ctx.font = '10px sans';
  ctx.fillText(`\u0394T = ${frameDT.toFixed(3)}s`, 10, 10);
}
