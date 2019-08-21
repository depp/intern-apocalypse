/**
 * Debug view of the level.
 */

import { AssertionError } from './debug';
import { debugView } from './debug_controls';
import { ctx } from './debug_global';
import { Cell, Edge } from './level';
import { Vector } from './math';
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
 * Calculate vertex for line join.
 */
function joinVertex(
  v0: Readonly<Vector>,
  v1: Readonly<Vector>,
  v2: Readonly<Vector>,
  distance: number,
): Vector {
  let x1 = v1.y - v0.y,
    y1 = v0.x - v1.x;
  let x2 = v2.y - v1.y,
    y2 = v1.x - v2.x;
  const a1 = 1 / Math.hypot(x1, y1);
  const a2 = 1 / Math.hypot(x2, y2);
  x1 *= a1;
  y1 *= a1;
  x2 *= a2;
  y2 *= a2;
  const b = x1 * x2 + y1 * y2;
  const limit = 5;
  const c = distance * (b > -(limit - 1) / limit ? 1 / (1 + b) : limit);
  return {
    x: v1.x - c * (x1 + x2),
    y: v1.y - c * (y1 + y2),
  };
}

/**
 * Draw an interior cell in the level.
 */
function drawInteriorCell(cell: Cell, scale: number): void {
  const inset = 2 / scale;
  const { edge } = cell;
  if (edge == null) {
    throw new AssertionError('edge is null', { cell });
  }

  ctx.beginPath();
  let { x, y } = joinVertex(
    edge.prev!.vertex0,
    edge.vertex0,
    edge.vertex1,
    inset,
  );
  ctx.moveTo(x, y);
  for (let cur = edge.next; cur != edge; cur = cur.next) {
    if (cur == null) {
      throw new AssertionError('edge is null', { cell });
    }
    ({ x, y } = joinVertex(cur.prev!.vertex0, cur.vertex0, cur.vertex1, inset));
    ctx.lineTo(x, y);
  }
  ctx.lineJoin = 'bevel';
  ctx.lineWidth = 3 / scale;
  ctx.closePath();
  ctx.stroke();

  if (debugView.centroids) {
    ctx.beginPath();
    ({ x, y } = cell.center);
    ctx.arc(x, y, 4 / scale, 0, 2 * Math.PI);
    ctx.fillStyle = '#ccc';
    ctx.fill();

    ctx.beginPath();
    ({ x, y } = cell.centroid());
    ctx.arc(x, y, 4 / scale, 0, 2 * Math.PI);
    ctx.fillStyle = '#c33';
    ctx.fill();
  }
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
function drawEntity(pos: Vector): void {
  const { x, y } = pos;
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
  ctx.translate(-playerPos.x, -playerPos.y);
  for (const cell of level.cells.values()) {
    if (cell.index >= 0) {
      drawCell(cell, scale);
    }
  }
  if (debugView.player) {
    drawEntity(playerPos);
  }
  ctx.restore();
}
