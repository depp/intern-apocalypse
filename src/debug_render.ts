/**
 * Debug renderer. Draws the game using simple 2D graphics.
 */

import { debugView } from './debug_controls';
import { ctx, initContext } from './debug_global';
import { resetLevelDebug, drawLevel } from './debug_level';
import { frameDT } from './time';

/**
 * Draw the timing stats.
 */
function drawDT() {
  ctx.font = '10px sans';
  ctx.fillText(`\u0394T = ${frameDT.toFixed(3)}s`, 10, 10);
}

/**
 * Render the debug info.
 */
export function renderDebug(): void {
  initContext();
  ctx.clearRect(0, 0, 800, 600);
  if (debugView.level) {
    drawLevel();
  }
  resetLevelDebug();
  drawDT();
}
