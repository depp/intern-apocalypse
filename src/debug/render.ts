/**
 * Debug renderer. Draws the game using simple 2D graphics.
 */

import { debugView } from '../lib/settings';
import { ctx, initContext } from './global';
import { resetLevelDebug, drawLevel } from './level';
import { frameDT } from '../game/time';
import { getCameraTarget } from '../game/camera';
import { canvas } from '../lib/global';

/**
 * Draw the timing stats.
 */
function drawDT() {
  ctx.save();
  ctx.font = '10px sans';
  ctx.fillText(`\u0394T = ${frameDT.toFixed(3)}s`, 10, 10);
  ctx.restore();
}

function drawCoordinates(): void {
  const { x, y } = getCameraTarget();
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(-150, 0, 150, 20);
  ctx.fillStyle = '#000';
  ctx.font = '14px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`(${x.toFixed(1)}, ${y.toFixed(1)})`, -10, 14);
  ctx.restore();
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
  if (debugView.coordinates) {
    drawCoordinates();
  }
  resetLevelDebug();
  drawDT();
}
