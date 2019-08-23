/**
 * Game renderer.
 */

import { gl } from './global';
import { renderModels } from './render.model';

/**
 * Render the game.
 */
export function render(): void {
  gl.clearColor(0.5, 0.5, 0.5, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  renderModels();
}
