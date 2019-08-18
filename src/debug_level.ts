/**
 * Debug view of the level.
 */

import { ctx } from './debug_global';
import { Cell, level } from './level';

/**
 * Draw a cell in the level.
 */
function drawCell(cell: Cell, scale: number): void {
  const { edges } = cell;
  ctx.beginPath();
  let { x, y } = edges[0];
  ctx.moveTo(x * scale, -y * scale);
  for (let i = 1; i < edges.length; i++) {
    ({ x, y } = edges[i]);
    ctx.lineTo(x * scale, -y * scale);
  }
  ctx.closePath();

  ctx.lineWidth = 4;
  ctx.stroke();
}

/**
 * Draw a 2D view of the level.
 */
export function drawLevel(): void {
  const { clientWidth, clientHeight } = ctx.canvas;
  ctx.save();
  ctx.translate(clientWidth / 2, clientHeight / 2);
  drawCell(level, 20);
  ctx.restore();
}
