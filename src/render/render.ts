/**
 * Game renderer.
 */

import { gl } from '../lib/global';
import { renderLevel } from './level';
import { renderModels } from './model';

/**
 * Render the game.
 */
export function render(): void {
  gl.clearColor(0.5, 0.5, 0.5, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  renderModels();
  renderLevel();
}
