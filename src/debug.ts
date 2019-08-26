/**
 * Debug assertions and logging.
 */

/**
 * True if this is the debug build.
 */
export const isDebug: boolean = true;

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
export const enum DebugColor {
  None,
  Red,
  Green,
  Blue,
  Cyan,
  Magenta,
  Yellow,
  Black,
  Gray,
  White,
}

/** Values of colors for objects on the debug map. */
export const debugColors: { [c in DebugColor]: string } = {
  [DebugColor.None]: '',
  [DebugColor.Red]: '#f00',
  [DebugColor.Green]: '#0f0',
  [DebugColor.Blue]: '#00f',
  [DebugColor.Cyan]: '#0ff',
  [DebugColor.Magenta]: '#f0f',
  [DebugColor.Yellow]: '#ff0',
  [DebugColor.Black]: '#000',
  [DebugColor.Gray]: '#555',
  [DebugColor.White]: '#fff',
};
