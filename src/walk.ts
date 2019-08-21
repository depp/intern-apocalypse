/**
 * Walking movement.
 */

import { DebugColor } from './debug';
import { Vector, lerp, distance, madd } from './math';
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
  for (const edge of level.findEdges(start, walkerRadius)) {
    edge.debugColor = DebugColor.Red;
  }
  return target;
}
