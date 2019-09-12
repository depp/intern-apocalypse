/**
 * Input handling module. Reads input from the keyboard and translates it into
 * more abstract buttons like "left" and "right".
 */

/**
 * Input buttons that can be pressed.
 *
 * We use strings here because the strings will optimize down to property
 * accesses. As a const enum, it will not be emitted as JavaScript.
 *
 * Note: If this is modified, update zeroButtons, below.
 */
export const enum Button {
  Left = 'l',
  Right = 'r',
  Backward = 'b',
  Forward = 'f',
  Action = 'a',
  Select = 's',
  Menu = 'm',
}

/**
 * Map from events to buttons.
 *
 * These are taken from KeyboardEvent.code, and correspond to physical locations
 * on the keyboard. This means that on a French keyboard, you will use ZQSD
 * (which is the desired behavior). This appears to be unsuppored on IE or Edge,
 * but is supported by Firefox, Chrome, and Safari.
 *
 * See: https://caniuse.com/#feat=keyboardevent-code
 *
 * See: https://www.w3.org/TR/uievents/
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
 *
 * For constants, see: https://www.w3.org/TR/uievents-code/
 */
const buttonBindings: Record<string, Button> = {
  // WASD
  'KeyW': Button.Forward,
  'KeyA': Button.Left,
  'KeyS': Button.Backward,
  'KeyD': Button.Right,

  // Arrow keys
  'ArrowUp': Button.Forward,
  'ArrowLeft': Button.Left,
  'ArrowDown': Button.Backward,
  'ArrowRight': Button.Right,

  // Action / attack
  'Space': Button.Action,
  'ControlLeft': Button.Action,
  'ControlRight': Button.Action,

  // Menu controls
  'Enter': Button.Select,
  'Escape': Button.Menu,
};

/**
 * Map from buttons to numbers.
 *
 * Note that we cannot define this as an interface. See:
 * https://github.com/microsoft/TypeScript/issues/2491
 */
type ButtonRecord<T> = { [k in Button]: T };

/**
 * Contains truthy values for each button that was pressed this frame (edge
 * triggered).
 *
 * Type assertion: We should not be using this object before calling
 * startInput().
 */
export const buttonPress: ButtonRecord<number> = {} as ButtonRecord<number>;

/**
 * Contains truthy values for each button that is currently down (state
 * triggered).
 *
 * Type assertion: We should not be using this object before calling
 * startInput().
 */
export const buttonState: ButtonRecord<number> = {} as ButtonRecord<number>;

/** Set all buttons in the record to 0. */
function zeroButtons(buttons: ButtonRecord<number>): void {
  for (const c of 'lrbfasm') {
    buttons[c as Button] = 0;
  }
}

/** Handle a keydown event. */
function handleKeyDown(evt: KeyboardEvent) {
  const binding = buttonBindings[evt.code];
  if (binding) {
    buttonPress[binding] = 1;
    buttonState[binding] = 1;
    evt.preventDefault();
  }
}

/** Handle a keyup event. */
function handleKeyUp(evt: KeyboardEvent): void {
  const binding = buttonBindings[evt.code];
  if (binding) {
    buttonState[binding] = 0;
    evt.preventDefault();
  }
}

/**
 * Start listening for player input.
 */
export function startInput(): void {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  zeroButtons(buttonPress);
  zeroButtons(buttonState);
}

/**
 * Handle the end of the current frame.
 *
 * This must be called after all inputs have been processed for the frame, but
 * before any new inputs are recieved by event handlers. It should onyl be
 * called by main().
 */
export function endFrameInput(): void {
  zeroButtons(buttonPress);
}

/**
 * Get the value of an axis controlled by button presses.
 *
 * For example, with Button.Left and Button.Right, returns +1 for right, -1 for
 * left, and 0 for neither or both.
 */
export function buttonAxis(negative: Button, positive: Button): number {
  return buttonState[positive] - buttonState[negative];
}
