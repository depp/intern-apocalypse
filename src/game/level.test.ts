import { Cell, Edge, LevelBuilder } from './level';
import { Vector } from '../lib/math';

class Failure extends Error {}

interface CellInfo {
  x: number;
  y: number;
  edges: number;
}

interface Test {
  name: string;
  cells: CellInfo[];
  bounds: number[]; // Top, left, bottom, right.
}

const tests: readonly Test[] = [
  {
    name: '1. basic',
    cells: [{ x: 0, y: 0, edges: 4 }],
    bounds: [1, 1, 1, 1],
  },
  {
    name: '2. horizontal',
    cells: [{ x: 0, y: 1, edges: 4 }, { x: 0, y: -1, edges: 4 }],
    bounds: [1, 2, 1, 2],
  },
  {
    name: '2. vertical',
    cells: [{ x: 1, y: 0, edges: 4 }, { x: -1, y: 0, edges: 4 }],
    bounds: [2, 1, 2, 1],
  },
  {
    name: '2: corner',
    cells: [{ x: 0, y: 0, edges: 5 }, { x: 4, y: 4, edges: 3 }],
    bounds: [2, 1, 1, 2],
  },
  {
    name: '2. diagonal A',
    cells: [{ x: -1, y: 1, edges: 3 }, { x: 1, y: -1, edges: 3 }],
    bounds: [1, 1, 1, 1],
  },
  {
    name: '2. diagonal B',
    cells: [{ x: 1, y: 1, edges: 3 }, { x: -1, y: -1, edges: 3 }],
    bounds: [1, 1, 1, 1],
  },
  {
    name: '2. diagnonal C',
    cells: [{ x: 0, y: -1, edges: 4 }, { x: 1, y: 1, edges: 4 }],
    bounds: [1, 2, 1, 2],
  },
  {
    name: '3. wye',
    cells: [
      { x: 0, y: -1, edges: 5 },
      { x: 1, y: 1, edges: 4 },
      { x: -1, y: 1, edges: 4 },
    ],
    bounds: [2, 2, 1, 2],
  },
  {
    name: '3. stack',
    cells: [
      { x: 0, y: 0, edges: 4 },
      { x: 0, y: 1, edges: 4 },
      { x: 0, y: -1, edges: 4 },
    ],
    bounds: [1, 3, 1, 3],
  },
  {
    name: '4: square',
    cells: [
      { x: 1, y: 1, edges: 4 },
      { x: -1, y: -1, edges: 4 },
      { x: 1, y: -1, edges: 4 },
      { x: -1, y: 1, edges: 4 },
    ],
    bounds: [2, 2, 2, 2],
  },
  {
    // Four cells on the boundary plus an interior rectangle.
    name: '5: interior',
    cells: [
      { x: 0, y: 4, edges: 6 },
      { x: 2, y: 0, edges: 4 },
      { x: 0, y: -3, edges: 6 },
      { x: -1, y: 0, edges: 4 },
      { x: 0, y: 0, edges: 4 },
    ],
    bounds: [1, 3, 1, 3],
  },
];

function winding(v1: Vector, v2: Vector, v3: Vector): number {
  const dx1 = v2.x - v1.x;
  const dx2 = v3.x - v1.x;
  const dy1 = v2.y - v1.y;
  const dy2 = v3.y - v1.y;
  return dx1 * dy2 - dx2 * dy1;
}

function pt(v: Vector): string {
  return `(${v.x},${v.y})`;
}

function pcell(c: Cell | null) {
  return c ? `cell[${c.index}]` : 'null';
}

function pedge(e: Edge | null) {
  return e ? `edge[${e.index}]` : 'null';
}

function checkEdge(
  cell: Cell,
  edge: Edge,
  next: Edge | null,
  prev: Edge | null,
): void {
  if (edge.cell != cell) {
    throw new Failure(`cell = ${pcell(edge.cell)}, want ${pcell(cell)}`);
  }
  if (edge.prev != prev) {
    throw new Failure(`prev = ${pedge(edge.prev)}, want ${pedge(prev)}`);
  }
  if (edge.next != next) {
    throw new Failure(`next = ${pedge(edge.next)}, want ${pedge(next)}`);
  }
  if (prev && edge.vertex0 != prev.vertex1) {
    throw new Failure(
      `vertex0 = ${pt(edge.vertex0)}, prev.vertex1 = ${pt(prev.vertex1)}`,
    );
  }
  if (next && edge.vertex1 != next.vertex0) {
    throw new Failure(
      `vertex1 = ${pt(edge.vertex1)}, next.vertex0 = ${pt(next.vertex0)}`,
    );
  }
}

function checkWinding(cell: Cell, edge: Edge) {
  const { center } = cell;
  let w: number;
  w = winding(center, edge.vertex0, edge.vertex1);
  if (w <= 0) {
    throw new Failure(
      `invalid winding: ` +
        `center=${pt(center)}, v0=${pt(edge.vertex0)}, v1=${pt(edge.vertex1)}`,
    );
  }
  const { prev } = edge;
  if (prev) {
    w = winding(prev.vertex0, edge.vertex0, edge.vertex1);
    if (w <= 0) {
      throw new Failure('not convex');
    }
  }
}

function getEdges(cell: Cell): Edge[] {
  const edgeIndexes = new Set<number>();
  let edge: Edge | null = cell.edge;
  let edges: Edge[] = [];
  while (edge != null && !edgeIndexes.has(edge.index)) {
    edgeIndexes.add(edge.index);
    edges.push(edge);
    edge = edge.next;
  }
  edge = cell.edge.prev;
  while (edge != null && !edgeIndexes.has(edge.index)) {
    edgeIndexes.add(edge.index);
    edges.unshift(edge);
    edge = edge.prev;
  }
  return edges;
}

function checkCell(cell: Cell, info: CellInfo): void {
  const edges = getEdges(cell);
  const n = edges.length;
  for (let i = 0; i < n; i++) {
    const edge = edges[i];
    const next = edges[(i + 1) % n];
    const prev = edges[(i + n - 1) % n];
    try {
      checkEdge(cell, edge, next, prev);
      checkWinding(cell, edge);
    } catch (e) {
      if (e instanceof Failure) {
        throw new Failure(`edge #${i}: ${e.message}`);
      }
      throw e;
    }
  }
  if (n != info.edges) {
    throw new Failure(`got ${n} edges, expect ${info.edges}`);
  }
}

function cellFailure(cell: Cell, e: Failure): never {
  const edges = getEdges(cell);
  console.log(`Cell #${cell.index}`);
  for (let i = 0; i < edges.length; i++) {
    const { index, vertex0, vertex1 } = edges[i];
    console.log(`  edge[${i}] #${index}: ${pt(vertex0)} => ${pt(vertex1)}`);
  }
  throw new Failure(`cell #${cell.index}: ${e.message}`);
}

function checkBoundary(cell: Cell, count: number): void {
  const edges = getEdges(cell);
  const n = edges.length;
  for (let i = 0; i < n; i++) {
    const edge = edges[i];
    const next = i + 1 < n ? edges[i + 1] : null;
    const prev = i > 0 ? edges[i - 1] : null;
    try {
      checkEdge(cell, edge, next, prev);
    } catch (e) {
      if (e instanceof Failure) {
        throw new Failure(`edge ${i}: ${e.message}`);
      }
      throw e;
    }
  }
  if (n != count) {
    throw new Failure(`got ${n} edges, expect ${count}`);
  }
}

function runTest(test: Test): void {
  const { name, cells, bounds } = test;
  const level = new LevelBuilder();
  level.createLevel(5, cells);
  for (let i = 0; i < bounds.length; i++) {
    const cell = level.cells.get(-i - 1);
    if (!cell) {
      throw new Failure(`missing cell #${-i - 1}`);
    }
    try {
      checkBoundary(cell, bounds[i]);
    } catch (e) {
      if (e instanceof Failure) {
        cellFailure(cell, e);
      }
      throw e;
    }
  }
  for (let i = 0; i < cells.length; i++) {
    const info = cells[i];
    const cell = level.cells.get(i);
    if (cell == null) {
      throw new Failure(`missing cell #${i}`);
    }
    try {
      checkCell(cell, cells[i]);
    } catch (e) {
      if (e instanceof Failure) {
        cellFailure(cell, e);
      }
      throw e;
    }
  }
}

describe('Level generation', () => {
  for (const test of tests) {
    it(test.name, () => runTest(test));
  }
});
