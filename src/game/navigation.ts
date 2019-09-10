/**
 * Entity navigation.
 */

import { Vector, distance, zeroVector, normalizeSubtract } from '../lib/math';
import { level } from './world';
import { Cell } from './level';
import { AssertionError } from '../debug/debug';

/** Result of a navigation query. */
export interface NavigationResult {
  /** Direction to navigate in. */
  direction: Vector;
  /** Distance, along the path, to get to the target. */
  distance: number;
}

/** Information about how to navigate the level. */
export interface NavigationGraph {
  /** Update the graph to navigate to the given target. */
  update(target: Vector | undefined | null): void;

  /** Calculate how to navigate from the given position. */
  navigate(start: Vector): NavigationResult;
}

/** Create an empty navigation graph. */
export function newNavigationGraph(): NavigationGraph {
  const count = level.cells.length;
  const nextData = new Int32Array(count);
  const distanceData = new Float32Array(count);

  function zero(): void {
    nextData.fill(-1);
    distanceData.fill(0);
  }

  zero();

  return {
    update(target: Vector | undefined | null): void {
      zero();
      if (!target) {
        return;
      }
      // Simple breadth-first search...
      const cell = level.findCell(target);
      const initialDistance = distance(cell.center, target);
      interface Node {
        cell: Cell;
        navigateDistance: number;
        next: Cell;
      }
      // We set the initial cell to point to itself at first, so we can use this
      // property to test if a cell has been visited.
      const frontier: Node[] = [
        { cell, navigateDistance: initialDistance, next: cell },
      ];
      while (frontier.length) {
        let nextNode = 0;
        for (let i = 1; i < frontier.length; i++) {
          if (
            frontier[i].navigateDistance < frontier[nextNode].navigateDistance
          ) {
            nextNode = i;
          }
        }
        const { cell, navigateDistance, next } = frontier[nextNode];
        frontier[nextNode] = frontier[frontier.length - 1];
        frontier.pop();
        if (nextData[cell.index] < 0) {
          nextData[cell.index] = next.index;
          distanceData[cell.index] = navigateDistance;
          for (const edge of cell.edges()) {
            const { back } = edge;
            if (back && back.passable) {
              const prev = back.cell;
              if (!prev) {
                throw new AssertionError('cell = null');
              }
              if (nextData[prev.index] < 0) {
                frontier.push({
                  cell: prev,
                  navigateDistance:
                    navigateDistance + distance(cell.center, prev.center),
                  next: cell,
                });
              }
            }
          }
        }
      }
    },
    navigate(start: Vector): NavigationResult {
      const { index } = level.findCell(start);
      const next = nextData[index];
      return {
        direction:
          next < 0
            ? zeroVector
            : normalizeSubtract(level.cells[next].center, start),
        distance: distanceData[index],
      };
    },
  };
}
