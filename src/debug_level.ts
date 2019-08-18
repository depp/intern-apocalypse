/**
 * Debug view of the level.
 */

import { ctx } from './debug_global';
import { Cell, level } from './level';
import { playerPos } from './player';

/**
 * Draw a cell in the level.
 */
function drawCell(cell: Cell, scale: number): void {
  const { edges } = cell;
  ctx.beginPath();
  let { x, y } = edges[0];
  ctx.moveTo(x, y);
  for (let i = 1; i < edges.length; i++) {
    ({ x, y } = edges[i]);
    ctx.lineTo(x, y);
  }
  ctx.closePath();

  ctx.lineWidth = 4 / scale;
  ctx.stroke();
}

/**
 * Draw an entity in the level.
 */
function drawEntity(pos: [number, number]): void {
  const [x, y] = pos;
  ctx.beginPath();
  ctx.arc(x, y, 1.0, 0, 2 * Math.PI);

  ctx.fillStyle = '#f00';
  ctx.fill();
}

/**
 * Draw a 2D view of the level.
 */
export function drawLevel(): void {
  const { clientWidth, clientHeight } = ctx.canvas;
  const scale = 20;
  ctx.save();
  ctx.translate(clientWidth / 2, clientHeight / 2);
  ctx.scale(scale, -scale);
  drawCell(level, scale);
  drawEntity(playerPos);
  ctx.restore();
}
