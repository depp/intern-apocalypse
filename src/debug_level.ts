/**
 * Debug view of the level.
 */

import { AssertionError } from './debug';
import { ctx } from './debug_global';
import { Cell } from './level';
import { playerPos } from './player';
import { level } from './world';

/**
 * Draw a border cell in the level.
 */
function drawBorderCell(cell: Cell, scale: number): void {
  const { edge } = cell;
  if (edge == null) {
    throw new AssertionError('edge is null', { cell });
  }
  let first = edge;
  while (first.prev) {
    first = first.prev;
  }
  let last = edge;
  while (last.next) {
    last = last.next;
  }

  ctx.beginPath();
  let { x, y } = first.vertex0;
  ctx.moveTo(x, y);
  ({ x, y } = first.vertex1);
  ctx.lineTo(x, y);

  ctx.lineWidth = 4 / scale;
  ctx.stroke();
}

/**
 * Draw an interior cell in the level.
 */
function drawInteriorCell(cell: Cell, scale: number): void {
  const { edge } = cell;
  if (edge == null) {
    throw new AssertionError('edge is null', { cell });
  }

  ctx.beginPath();
  let { x, y } = edge.vertex0;
  ctx.moveTo(x, y);
  for (let cur = edge.next; cur != edge; cur = cur.next) {
    if (cur == null) {
      throw new AssertionError('edge is null', { cell });
    }
    ({ x, y } = cur.vertex0);
    ctx.lineTo(x, y);
  }
  ctx.lineWidth = 4 / scale;
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ({ x, y } = cell.center);
  ctx.arc(x, y, 4 / scale, 0, 2 * Math.PI);
  ctx.fillStyle = '#ccc';
  ctx.fill();
}

/**
 * Draw a cell in the level.
 */
function drawCell(cell: Cell, scale: number): void {
  if (cell.index < 0) {
    drawBorderCell(cell, scale);
  } else {
    drawInteriorCell(cell, scale);
  }
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
  for (const cell of level.cells.values()) {
    if (cell.index >= 0) {
      drawCell(cell, scale);
    }
  }
  // drawEntity(playerPos);
  ctx.restore();
}
