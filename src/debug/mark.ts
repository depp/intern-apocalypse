import { Vector } from '../lib/math';
import { DebugColor } from './debug';

export interface DebugMarkBase {
  /** Time remaining before mark disappears. */
  time: number;
  /** Kind of mark this is. */
  kind: string;
}

/** A circle marker for the debug map. */
export interface DebugMarkCircle extends DebugMarkBase {
  kind: 'circle';
  /** Position of mark. */
  pos: Vector;
  /** Radius of mark. */
  radius: number;
  /** Color to draw mark with. */
  color: DebugColor;
}

/** A rectangle for the debug map. */
export interface DebugMarkRectangle extends DebugMarkBase {
  kind: 'rectangle';
  /** Position of mark. */
  min: Vector;
  max: Vector;
  /** Color to draw mark with. */
  color: DebugColor;
}

export type DebugMark = DebugMarkCircle | DebugMarkRectangle;

/** List of all debug marks in the level. */
export const debugMarks: DebugMark[] = [];
