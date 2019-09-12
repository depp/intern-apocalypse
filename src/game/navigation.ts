/**
 * Entity navigation.
 */

import { Vector, distance, zeroVector, normalizeSubtract } from '../lib/math';
import { Cell, Level } from './level';
import { AssertionError } from '../debug/debug';

/** Result of a navigation query. */
export interface NavigationResult {
  /** Direction to navigate in. */
  direction: Vector;
  /** Distance, along the path, to get to the target. */
  distance: number;
  /** Closest target. */
  target: Vector;
}

/** Information about how to navigate the level. */
export interface NavigationGraph {
  /** Update the graph to navigate to the given targets. */
  update(targets: Vector[]): void;

  /** Calculate how to navigate from the given position. */
  navigate(start: Vector): NavigationResult;

  /** Raw distance data, map from cell index to height. */
  readonly distanceData: Float32Array;
  /** Raw target data, map from cell index to index of closest target. */
  readonly targetData: Int32Array;
}

/** Create an empty navigation graph. */
export function newNavigationGraph(level: Level): NavigationGraph {
  const count = level.cells.length;
  const nextData = new Int32Array(count);
  const distanceData = new Float32Array(count);
  const targetData = new Int32Array(count);
  let targetLocations: Vector[];

  function zero(): void {
    nextData.fill(-1);
    distanceData.fill(0);
    targetData.fill(-1);
  }

  zero();

  return {
    update(targets: Vector[]): void {
      zero();
      if (!targets.length) {
        return;
      }
      targetLocations = [...targets];
      // Simple breadth-first search...
      //
      // We set the initial cell to point to itself at first, so we can use this
      // property to test if a cell has been visited.
      interface Node {
        cell: Cell;
        navigateDistance: number;
        next: Cell;
        target: number;
      }
      const frontier: Node[] = [];
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const cell = level.findCell(target);
        const initialDistance = distance(cell.center, target);
        frontier.push({
          cell,
          navigateDistance: initialDistance,
          next: cell,
          target: i,
        });
      }
      while (frontier.length) {
        let nextNode = 0;
        for (let i = 1; i < frontier.length; i++) {
          if (
            frontier[i].navigateDistance < frontier[nextNode].navigateDistance
          ) {
            nextNode = i;
          }
        }
        const { cell, navigateDistance, next, target } = frontier[nextNode];
        frontier[nextNode] = frontier[frontier.length - 1];
        frontier.pop();
        const index = cell.index;
        if (nextData[index] < 0) {
          nextData[index] = next.index;
          distanceData[index] = navigateDistance;
          targetData[index] = target;
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
                  target,
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
      if (next < 0) {
        return {
          direction: zeroVector,
          distance: 0,
          target: zeroVector,
        };
      }
      const targetIndex = targetData[index];
      if (targetIndex == -1) {
        throw new AssertionError('null target', { start });
      }
      const target = targetLocations[targetIndex];
      if (!target) {
        throw new AssertionError('null target', { start, targetIndex });
      }
      return {
        direction: normalizeSubtract(level.cells[next].center, start),
        distance: distanceData[index],
        target,
      };
    },
    distanceData,
    targetData,
  };
}
