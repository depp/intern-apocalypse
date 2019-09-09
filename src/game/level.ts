/**
 * Levels, the static geometry where the game takes place.
 */

import { AssertionError, DebugColor } from '../debug/debug';
import {
  Vector,
  distanceSquared,
  findLineSplit,
  lerp,
  lineIntersectsCircle,
  vector,
} from '../lib/math';

/**
 * The smallest area in a level.
 *
 * A cell is a convex polygon. Each edge of the cell may be shared with another
 * cell.
 */
export interface Cell {
  /** The center of the cell. */
  readonly center: Vector;
  /** The index of this cell, identifies this cell. */
  readonly index: number;
  /** Arbitrary edge in the cell. */
  edge: Edge;
  /** True if you can walk through this cell. */
  walkable: boolean;
  /** The next cell that monsters should navigate to. */
  navigateNext: Cell | null;
  /** The distance from the player, following the navigation path. */
  navigateDistance: number;
  /** Calculate the centroid of the cell. */
  centroid(): Vector;
  /** Iterate over all cell edges, exactly once each. */
  edges(): IterableIterator<Edge>;
}

/**
 * Create a new cell.
 */
function makeCell(center: Vector, index: number, firstEdge: Edge): Cell {
  function centroid(this: Cell): Vector {
    let area = 0,
      xarea = 0,
      yarea = 0;
    for (const { vertex0, vertex1 } of this.edges()) {
      const a = vertex0.x * vertex1.y - vertex1.x * vertex0.y;
      area += a / 2;
      xarea += ((vertex0.x + vertex1.x) * a) / 6;
      yarea += ((vertex0.y + vertex1.y) * a) / 6;
    }
    return vector(xarea / area, yarea / area);
  }
  function* edges(this: Cell): IterableIterator<Edge> {
    let { edge } = this;
    if (this.index < 0) {
      while (edge.prev) {
        edge = edge.prev;
      }
    }
    let cur: Edge | null = this.edge;
    do {
      yield cur;
      cur = cur.next;
    } while (cur && cur != edge);
  }
  const cell: Cell = {
    center,
    index,
    edge: firstEdge,
    walkable: true,
    centroid,
    edges,
    navigateNext: null,
    navigateDistance: 0,
  };
  let edge: Edge | null = firstEdge;
  do {
    if (edge.cell != null) {
      throw new AssertionError('edge is already in use');
    }
    edge.cell = cell;
    edge = edge.next;
  } while (edge && edge != firstEdge);
  return cell;
}

/**
 * An edge of a cell.
 *
 * The edge only contains the more clockwise vertex. The anticlockwise vertex is
 * stored in the next edge. The edges are linked in a circular linked list.
 */
export interface Edge {
  /** Clockwise vertex. */
  vertex0: Vector;

  /** Anticlockwise vertex. */
  vertex1: Vector;

  /** The center of an arbitrary adjacent cell, other than the root cell. */
  center: Vector;

  /**
   * The index of this edge within the level.
   *
   * Each edge is paired with another edge, back to back, and the pairs are
   * allocated sequentially. So the back side of this edge has index equal to
   * (index^1).
   */
  index: number;

  /**
   * True if the player can walk through the edge from front to back. This
   * should not be set manually, it is set by updateProperties().
   */
  passable: boolean;

  /** The that this edge belongs to. */
  cell: Cell | null;

  /**
   * Reference to the previous (clockwise) edge. These form a circular linked
   * list for each cell, except the border cells.
   */

  prev: Edge | null;

  /**
   * Reference to next (anticlockwise) edge. These form a circular linked list
   * for each cell, except the border cells.
   */
  next: Edge | null;

  /** Highlight color for this edge. */
  debugColor?: DebugColor;

  /** Highlight color for vertex0. */
  debugVertexColor?: DebugColor;
}

/** A game level, consisting of cells and the edges that connect them. */
export interface Level {
  readonly cells: ReadonlyMap<number, Cell>;
  readonly edges: ReadonlyMap<number, Edge>;

  /**
   * Find the cell that contains the given point.
   */
  findCell(point: Vector): Cell;

  /**
   * Get the back side of the given edge.
   */
  edgeBack(edge: Edge): Edge;

  /**
   * Update precomputed properties.
   */
  updateProperties(): void;

  /**
   * List all edges within the given circle that cannot be walked thorugh.
   * @param center Center of the circle.
   * @param radius Radius of the circle.
   */
  findUnpassableEdges(center: Vector, radius: number): Edge[];
}

/**
 * Find an arbitrary edge that would be changed by creating a new cell with the
 * given center. This must not be called on border cells.
 */
function findAnySplitEdge(start: Edge, center: Vector): Edge {
  let edge = start;
  while (true) {
    // There must be at least one vertex which is strictly closer to the input.
    // This must be a strict test.
    if (
      distanceSquared(edge.center, edge.vertex0) >
      distanceSquared(center, edge.vertex0)
    ) {
      return edge;
    }
    const { next } = edge;
    if (next == null) {
      throw new AssertionError('missing edge link', { start, center });
    }
    if (next == start) {
      throw new AssertionError('no split found', { start, center });
    }
    edge = next;
  }
}

/**
 * Result of splitting a cell to accomodate a new cell.
 */
interface EdgeSplit {
  /** The edge to split. */
  front: Edge;
  /** The back of the edge to split (except for border cells). */
  back: Edge;
  /** The vertex for the split point, which may be front.vertex1. */
  vertex: Vector;
}

/**
 * Create a new level.
 * @param size Distance from origin to each level edge.
 * @param centers Center of each cell in the level.
 */
export function createLevel(size: number, centers: readonly Vector[]): Level {
  const cells = new Map<number, Cell>();
  const edges = new Map<number, Edge>();
  let cellCounter = 0;
  let edgeCounter = 0;

  {
    const center = centers[0];
    const vertexes: Vector[] = [
      vector(size, size),
      vector(-size, size),
      vector(-size, -size),
      vector(size, -size),
    ];
    const rootEdges: Edge[] = [];
    for (let i = 0; i < vertexes.length; i++) {
      const [e1, e2] = newEdgePair(
        vertexes[i],
        vertexes[(i + 1) % vertexes.length],
        center,
      );
      rootEdges.push(e1);
      const cell = makeCell(vertexes[i], -i - 1, e2);
      cell.walkable = false;
      cells.set(-i - 1, cell);
    }
    newCell(center, rootEdges);
    for (let i = 1; i < centers.length; i++) {
      addCell(centers[i]);
    }
  }

  /**
   * Find the cell that contains the given point.
   */
  function findCell(point: Vector): Cell {
    let bestDistanceSquared = Infinity;
    let bestCell: Cell | undefined;
    for (const parent of cells.values()) {
      if (parent.index >= 0) {
        const distSquared = distanceSquared(point, parent.center);
        if (distSquared < bestDistanceSquared) {
          bestDistanceSquared = distSquared;
          bestCell = parent;
        }
      }
    }
    if (!bestCell) {
      throw new AssertionError('findCell failed', { point });
    }
    return bestCell;
  }

  /**
   * Get the back side of the given edge.
   */
  function edgeBack(edge: Edge): Edge {
    if (edge == null) {
      throw new AssertionError('null edge');
    }
    const back = edges.get(edge.index ^ 1);
    if (back == null) {
      throw new AssertionError('could not find back to edge', { edge });
    }
    return back;
  }

  function newEdge(
    vertex0: Vector,
    vertex1: Vector,
    center: Vector,
    index: number,
  ): Edge {
    const edge: Edge = {
      vertex0,
      vertex1,
      center,
      index,
      passable: true,
      cell: null,
      prev: null,
      next: null,
    };
    edges.set(index, edge);
    return edge;
  }

  /**
   * Create a new edge pair and add them to the level.
   */
  function newEdgePair(
    vertex0: Vector,
    vertex1: Vector,
    center: Vector,
  ): [Edge, Edge] {
    const index = edgeCounter;
    edgeCounter += 2;
    return [
      newEdge(vertex0, vertex1, center, index),
      newEdge(vertex1, vertex0, center, index + 1),
    ];
  }

  /**
   * Create a new cell and add it to the level.
   * @param center Center of the cell.
   * @param edges Array of cell edges, in anticlockwise order.
   */
  function newCell(center: Vector, edges: readonly Edge[]): Cell {
    if (!edges.length) {
      throw new AssertionError('no edges');
    }
    const index = cellCounter++;
    let prev = edges[edges.length - 1];
    for (const edge of edges) {
      prev.next = edge;
      edge.prev = prev;
      prev = edge;
    }
    const cell = makeCell(center, index, prev);
    cells.set(index, cell);
    return cell;
  }

  /**
   * Create the split that would be introduced by adding a new cell with the given
   * center.
   */
  function createSplit(prev: Edge, newCenter: Vector): EdgeSplit {
    let front = prev;
    while (true) {
      const { vertex0, vertex1, center, next } = front;
      const diff =
        distanceSquared(newCenter, vertex1) - distanceSquared(center, vertex1);
      if (diff >= 0) {
        let vertex = vertex1;
        if (diff) {
          // The new vertex is somewhere on this current edge.
          const alpha = findLineSplit(vertex0, vertex1, center, newCenter);
          if (alpha <= 0 || 1 <= alpha) {
            throw new AssertionError('invalid line split', {
              prev,
              newCenter,
              alpha,
            });
          }
          vertex = lerp(vertex0, vertex1, alpha);
        }
        return { front, back: edgeBack(front), vertex };
      }
      if (!next) {
        // Find the next border cell.
        let back = edgeBack(front);
        while (back.prev) {
          back = edgeBack(back.prev);
        }
        // This will happen for border cells.
        return { front, back, vertex: vertex1 };
      }
      if (next == prev) {
        throw new AssertionError('no split found', { prev, newCenter });
      }
      front = next;
    }
  }

  /**
   * Add a new cell to the level.
   * @param center Center of the new cell.
   */
  function addCell(center: Vector): void {
    // Find a parent which must cede some space to the new cell. We know that
    // the cell containing the center of the new cell must do this.
    const firstCell = findCell(center);
    // Create split points for all cells bordering the new cell.
    let split = createSplit(findAnySplitEdge(firstCell.edge, center), center);
    const splits: EdgeSplit[] = [split];
    while (split.back.cell != firstCell) {
      split = createSplit(split.back, center);
      splits.push(split);
    }
    // Generate the edges from the splits.
    let { back, vertex: vertex0 } = split;
    const edges: Edge[] = [];
    for (const split of splits) {
      const { front, vertex: vertex1 } = split;
      const { cell } = front;
      if (!cell) {
        throw new AssertionError('cell is null');
      }
      if (front == back && cell.index >= 0) {
        throw new AssertionError('so that');
      }
      const [e1, e2] = newEdgePair(vertex0, vertex1, center);
      edges.push(e2);
      let prev: Edge | null, next: Edge | null;
      const eq0 = vertex0 == back.vertex0;
      const eq1 = vertex1 == front.vertex1;
      if (eq0) {
        ({ prev } = back);
      } else {
        prev = back;
        back.vertex1 = vertex0;
      }
      if (eq1) {
        ({ next } = front);
      } else {
        next = front;
        front.vertex0 = vertex1;
      }
      if (prev) {
        prev.next = e1;
        e1.prev = prev;
      }
      if (next) {
        next.prev = e1;
        e1.next = next;
      }
      cell.edge = e1;
      e1.cell = cell;
      ({ back, vertex: vertex0 } = split);
    }
    edges.reverse();
    // Generate the new cell.
    newCell(center, edges);
  }

  /**
   * List all edges within the given circle that cannot be walked thorugh.
   * @param center Center of the circle.
   * @param radius Radius of the circle.
   */
  function findUnpassableEdges(center: Vector, radius: number): Edge[] {
    const result: Edge[] = [];
    for (const cell of cells.values()) {
      if (cell.index >= 0) {
        for (const edge of cell.edges()) {
          if (
            !edge.passable &&
            lineIntersectsCircle(
              edge.vertex0,
              edge.vertex1,
              center,
              radius ** 2,
            )
          ) {
            result.push(edge);
          }
        }
      }
    }
    return result;
  }

  /**
   * Update precomputed properties.
   */
  function updateProperties() {
    for (let i = 0; i < edgeCounter; i += 2) {
      const edge0 = edges.get(i);
      const edge1 = edges.get(i + 1);
      if (edge0 && edge1) {
        const w0 = edge0.cell!.walkable;
        const w1 = edge1.cell!.walkable;
        edge0.passable = w1 || !w0;
        edge1.passable = w0 || !w1;
      }
    }
  }

  return {
    cells,
    edges,
    findCell,
    edgeBack,
    updateProperties,
    findUnpassableEdges,
  };
}
