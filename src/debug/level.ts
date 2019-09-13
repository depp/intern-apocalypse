/**
 * Debug view of the level.
 */

import { AssertionError, DebugColor, debugColors } from './debug';
import { debugView } from '../lib/settings';
import { ctx } from './global';
import { Cell, Edge } from '../game/level';
import { Vector, vector } from '../lib/math';
import { currentLevel } from '../game/campaign';
import { getCameraTarget } from '../game/camera';
import { debugMarks } from '../debug/mark';
import { frameDT } from '../game/time';
import { Collider, colliders } from '../game/physics';

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
  v0: Vector,
  v1: Vector,
  v2: Vector,
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
  return vector(v1.x - c * (x1 + x2), v1.y - c * (y1 + y2));
}

interface HighlightSet {
  edges: Edge[];
  vertexes: Vector[];
}

/** Map from highlight colors to lists of edges and vertexes with that color. */
const highlightSets = new Map<DebugColor, HighlightSet>();

/** Get the set of highligts for the given color, creating it if necessary. */
function getHighlight(color: DebugColor): HighlightSet {
  let set = highlightSets.get(color);
  if (set == null) {
    set = { edges: [], vertexes: [] };
    highlightSets.set(color, set);
  }
  return set;
}

/**
 * Check if an edge is highlighted and needs to be drawn later.
 */
function visitEdge(edge: Edge): void {
  const { debugColor, debugVertexColor, vertex0 } = edge;
  if (debugColor != null && debugColor != DebugColor.None) {
    getHighlight(debugColor).edges.push(edge);
  }
  if (debugVertexColor != null && debugVertexColor != DebugColor.None) {
    getHighlight(debugVertexColor).vertexes.push(vertex0);
  }
}

/**
 * Draw all highlighted edges.
 */
function drawHighlights(scale: number): void {
  const inset = edgeInset / scale;
  for (const [debugColor, set] of highlightSets.entries()) {
    const { edges } = set;
    if (!edges.length) {
      continue;
    }
    ctx.lineWidth = 6 / scale;
    ctx.strokeStyle = debugColors[debugColor];
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
  for (const [debugColor, set] of highlightSets.entries()) {
    const { vertexes } = set;
    if (!vertexes.length) {
      continue;
    }
    ctx.fillStyle = debugColors[debugColor];
    ctx.beginPath();
    for (const vertex of vertexes) {
      ctx.arc(vertex.x, vertex.y, 12 / scale, 0, 2 * Math.PI);
    }
    ctx.fill();
    vertexes.length = 0;
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
    ({ x, y } = cell.centroid);
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
function drawEntity(entity: Collider, scale: number): void {
  const { pos, debugArrow } = entity;
  if (!pos) {
    return;
  }

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, entity.radius, 0, 2 * Math.PI);
  ctx.fillStyle = '#800';
  ctx.fill();

  if (debugArrow) {
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + debugArrow.x, pos.y + debugArrow.y);
    ctx.strokeStyle = '#f88';
    ctx.lineWidth = 4 / scale;
    ctx.stroke();
  }
}

/**
 * Draw all debug marks.
 */
function drawMarks(scale: number): void {
  ctx.lineWidth = 3 / scale;
  for (const mark of debugMarks) {
    switch (mark.kind) {
      case 'circle':
        {
          const { pos, radius, color } = mark;
          ctx.beginPath();
          ctx.strokeStyle = debugColors[color];
          ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        }
        break;
      case 'rectangle':
        {
          const { rect, color } = mark;
          ctx.strokeStyle = debugColors[color];
          const { x0, y0, x1, y1 } = rect;
          ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        }
        break;
      default:
        const dummy: never = mark;
        throw new AssertionError('invalid mark');
    }
  }
}

/**
 * Update all debug marks.
 */
function updateMarks(): void {
  let i = 0;
  let j = 0;
  while (i < debugMarks.length) {
    const mark = debugMarks[i++];
    mark.time -= frameDT;
    if (mark.time > 0) {
      debugMarks[j++] = mark;
    }
  }
  debugMarks.length = j;
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
  const cameraTarget = getCameraTarget();
  ctx.translate(-cameraTarget.x, -cameraTarget.y);
  for (const cell of currentLevel.level.cells) {
    drawCell(cell, scale);
  }
  drawHighlights(scale);
  if (debugView.entities) {
    for (const entity of colliders) {
      drawEntity(entity, scale);
    }
    drawMarks(scale);
  }
  updateMarks();
  ctx.restore();
}

/**
 * Reset the debug view of the level.
 */
export function resetLevelDebug(): void {
  for (const edge of currentLevel.level.edges.values()) {
    edge.debugColor = DebugColor.None;
    edge.debugVertexColor = DebugColor.None;
  }
}
