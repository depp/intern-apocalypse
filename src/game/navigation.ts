import { Vector, distance } from '../lib/math';
import { levelTime } from './time';
import { level } from './world';
import { Cell } from './level';
import { AssertionError } from '../debug/debug';

/**
 * Entity navigation.
 */

/** The current navigation target. */
export let navigationTarget: Vector | null | undefined;

/** Next frame's navigation target. */
let nextTarget: Vector | null | undefined;

/** Interval, in seconds, between navigation updates. */
const navigationUpdateInterval = 0.5;

/** Level time when navigation graph was last updated.. */
let lastNavigationUpdateTime!: number;

/** Set the navigation target for next frame. */
export function setNavigationTarget(newTarget: Vector): void {
  nextTarget = newTarget;
}

/** Reset navigation, called at the beginning for the level. */
export function resetNavigation(): void {
  nextTarget = null;
  lastNavigationUpdateTime = -1;
}

/** Early update for navigation. Called at the beginning of every frame. */
export function beginFrameNavigation(): void {
  navigationTarget = nextTarget;
  nextTarget = null;
}

/** Update the navigation graph if necessary. */
export function updateNavigation(): void {
  if (levelTime < lastNavigationUpdateTime + navigationUpdateInterval) {
    return;
  }
  lastNavigationUpdateTime = levelTime;
  for (const cell of level.cells) {
    cell.navigateNext = null;
    cell.navigateDistance = 0;
  }
  if (!navigationTarget) {
    return;
  }
  // Simple breadth-first search...
  const cell = level.findCell(navigationTarget);
  const initialDistance = distance(cell.center, navigationTarget);
  interface Node {
    cell: Cell;
    navigateDistance: number;
    next: Cell;
  }
  // We set the initial cell to point to itself at first, so we can use this
  // field to test if a cell has been visited. It is cleaned up below.
  const frontier: Node[] = [
    { cell, navigateDistance: initialDistance, next: cell },
  ];
  while (frontier.length) {
    let index = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].navigateDistance < frontier[index].navigateDistance) {
        index = i;
      }
    }
    const { cell, navigateDistance, next } = frontier[index];
    frontier[index] = frontier[frontier.length - 1];
    frontier.pop();
    if (!cell.navigateNext) {
      cell.navigateNext = next;
      cell.navigateDistance = navigateDistance;
      for (const edge of cell.edges()) {
        const { back } = edge;
        if (back && back.passable) {
          const prev = back.cell;
          if (!prev) {
            throw new AssertionError('cell = null');
          }
          if (!prev.navigateDistance) {
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
  // Clean up the cycle we introduced.
  cell.navigateNext = null;
}
