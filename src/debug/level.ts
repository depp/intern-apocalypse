/**
 * Debug view of the level.
 */

import { AssertionError, DebugColor, debugColors } from './debug';
import { debugView } from '../lib/settings';
import { ctx } from './global';
import { Cell, Edge } from '../game/level';
import { Vector } from '../lib/math';
import { playerPos } from '../game/player';
import { walkerRadius } from '../game/walk';
import { level } from '../game/world';

const edgeInset = 2;

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

/** Map from highlight colors to lists of edges with that color. */
const edgeHighlight = new Map<DebugColor, Edge[]>();

/**
 * Check if an edge is highlighted and needs to be drawn later.
 */
function visitEdge(edge: Edge): void {
  const { debugColor } = edge;
  if (debugColor != null && debugColor != DebugColor.None) {
    let list = edgeHighlight.get(debugColor);
    if (!list) {
      list = [];
      edgeHighlight.set(debugColor, list);
    }
    list.push(edge);
  }
}

/**
 * Draw all highlighted edges.
 */
function drawEdges(scale: number): void {
  const inset = edgeInset / scale;
  for (const [debugColor, edges] of edgeHighlight.entries()) {
    if (edges.length) {
      ctx.strokeStyle = debugColors[debugColor];
      ctx.lineJoin = 'bevel';
      ctx.beginPath();
      for (const edge of edges) {
        const v0 = edge.prev!.vertex0;
        const v1 = edge.vertex0;
        const v2 = edge.vertex1;
        const v3 = edge.next!.vertex1;
        const e0 = joinVertex(v0, v1, v2, inset);
        const e1 = joinVertex(v1, v2, v3, inset);
        ctx.moveTo(e0.x, e0.y);
        ctx.lineTo(e1.x, e1.y);
      }
      ctx.stroke();
      edges.length = 0;
    }
  }
}

/**
 * Draw an interior cell in the level.
 */
function drawInteriorCell(cell: Cell, scale: number): void {
  const inset = edgeInset / scale;
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
  visitEdge(edge);
  for (let cur = edge.next; cur != edge; cur = cur.next) {
    if (cur == null) {
      throw new AssertionError('edge is null', { cell });
    }
    visitEdge(cur);
    ({ x, y } = joinVertex(cur.prev!.vertex0, cur.vertex0, cur.vertex1, inset));
    ctx.lineTo(x, y);
  }
  ctx.lineJoin = 'bevel';
  ctx.lineWidth = 3 / scale;
  ctx.closePath();
  if (cell.walkable) {
    ctx.fillStyle = 'rgba(0.2, 0.8, 0.1, 0.2)';
  } else {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  }
  ctx.fill();
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
  ctx.arc(x, y, walkerRadius, 0, 2 * Math.PI);

  ctx.fillStyle = '#f00';
  ctx.fill();
}

/**
 * Draw a 2D view of the level.
 */
export function drawLevel(): void {
  const { clientWidth, clientHeight } = ctx.canvas;
  const scale = 40;
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
  drawEdges(scale);
  ctx.restore();
}

/**
 * Reset the debug view of the level.
 */
export function resetLevelDebug(): void {
  for (const edge of level.edges.values()) {
    edge.debugColor = DebugColor.None;
  }
}
