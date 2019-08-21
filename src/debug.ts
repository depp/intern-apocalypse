/**
 * Debug assertions and logging.
 */

/**
 * Error sublcass for assertion failures.
 */
export class AssertionError extends Error {
  /** Additional key/value pairs with information for debugging. */
  readonly object: any;

  constructor(message: string, object: any = null) {
    if (object != null) {
      console.log(object);
    }
    super(message);
    this.object = object;
  }
}

/** Colors to use for highlighting objects on the debug map. */
export enum DebugColor {
  None,
  Red,
  Blue,
}
