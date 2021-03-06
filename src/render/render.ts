/**
 * Game renderer.
 */

import { gl, startGL } from '../lib/global';
import { updateRenderLevel } from './level';
import { renderModels } from './model';
import { renderParticles } from './particles';
import { renderUI, initRenderUI } from './ui';
import { initRandomVec4 } from './random';

/**
 * Initialize the renderer state. Creates the WebGL context.
 */
export function initRenderer(): void {
  startGL();
  initRandomVec4();
  initRenderUI();
}

/**
 * Render the game.
 */
export function render(): void {
  updateRenderLevel();

  gl.clearColor(0.5, 0.5, 0.5, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  renderModels();
  renderParticles();
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  renderUI();
}
