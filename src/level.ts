/**
 * Levels, the static geometry where the game takes place.
 */

/**
 * The smallest area in a level.
 *
 * A cell is a convex polygon. Each side of the cell may be shared with another
 * cell.
 */
export class Cell {
  /** X position of the cell center. */
  readonly x: number;
  /** Y position of the cell center. */
  readonly y: number;
  /** Edges of the cell, in anticlockwise order. */
  readonly edges: Edge[] = [];

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

/**
 * An edge of a cell.
 *
 * The edge only contains the more clockwise point. The anticlockwise point is
 * stored in the next edge.
 */
export class Edge {
  readonly x: number;
  readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

/**
 * Create a square cell with no neighbors.
 */
function createSquare(): Cell {
  const c = new Cell(0, 0);
  c.edges.push(
    new Edge(-5, -5),
    new Edge(5, -5),
    new Edge(5, 5),
    new Edge(-5, 5),
  );
  return c;
}

/**
 * Geometry for the current level.
 */
export const level: Cell = createSquare();
