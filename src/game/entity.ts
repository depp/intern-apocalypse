import { Vector } from '../lib/math';

/** A game entitiy. */
export interface Entity {
  update(): void;

  /** Position for debugging view. */
  debugPos?: Vector;
  /** Arrow for debugging view. */
  debugArrow?: Vector;
}
