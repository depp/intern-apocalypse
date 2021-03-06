/**
 * Common global variables.
 * @module src/global
 */

import { Vector, vector } from './math';

/** Game canvas element. */
export const canvas = document.getElementById('g') as HTMLCanvasElement;

/**
 * Get the location of a mouse event, in canvas coordinates.
 * @param evt The mouse event.
 */
export function getMousePos(evt: MouseEvent): Vector {
  // https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
  var rect = canvas.getBoundingClientRect();
  return vector(evt.clientX - rect.left, evt.clientY - rect.top);
}

/** WebGL rendering context. */
export let gl!: WebGLRenderingContext;

export function startGL(): void {
  gl = canvas.getContext('webgl', {
    'alpha': false,
  })!;
  if (!gl) {
    throw new Error('No WebGL.');
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
}

/**
 * Main game states.
 */
export const enum State {
  Loading = 1,
  MainMenu,
  Game,
  GameDialogue,
  GameMenu,
  Dead,
  DeadMenu,
}

/** The current game state. */
export let currentState: State = State.Loading;

/**
 * Set the current game state. Takes effect on the next frame, the actual
 * transition is handled by the main loop.
 */
export function setState(state: State): void {
  currentState = state;
}

/**
 * Pending text that should be shown to the player in the GameDialogue state.
 */
export let pendingDialogue: string;

/** Set the game state to GameDialogue and set the dialogue text. */
export function setGameDialogue(text: string): void {
  currentState = State.GameDialogue;
  pendingDialogue = text;
}
