/**
 * Walking movement.
 */

import { DebugColor } from './debug';
import { Vector, length, madd, wedgeSubtract } from './math';
import { level } from './world';

/** The collision radius of walking entities. */
export const walkerRadius = 0.5;

/**
 * Resolve walking movement.
 * @param start The point where movement starts.
 * @param movement The amount of movement that would happen if unobstructed.
 * @returns The point where movement ends.
 */
export function walk(
  start: Readonly<Vector>,
  movement: Readonly<Vector>,
): Readonly<Vector> {
  const target = madd(start, movement);
  const center = madd(start, movement, 0.5);
  for (const edge of level.findEdges(
    center,
    walkerRadius + length(movement) + 0.1,
  )) {
    edge.debugColor =
      wedgeSubtract(target, start, edge.vertex1, edge.vertex0) > 0
        ? DebugColor.Red
        : DebugColor.Blue;
  }
  return target;
}
