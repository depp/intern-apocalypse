/**
 * Debug rendering globals.
 */

/** Debug rendering canvas. */
let canvas!: HTMLCanvasElement;
/** Debug 2D rendering context. */
export let ctx!: CanvasRenderingContext2D;

/**
 * Initilaize the debug drawing context.
 */
export function initContext(): void {
  if (ctx == null) {
    if (canvas == null) {
      // Create new DOM elements.
      const div = document.createElement('div');
      div.setAttribute('id', 'container');
      const canvas3D = document.getElementById('g');
      if (!canvas3D) {
        throw new Error('missing canvas3D');
      }
      canvas = document.createElement('canvas');
      canvas.setAttribute('id', 'debugcanvas');
      canvas.width = 800;
      canvas.height = 600;
      // Reorganize so both canvases are children of the div.
      canvas3D.replaceWith(div);
      div.appendChild(canvas3D);
      div.appendChild(canvas);
    }
    const context = canvas.getContext('2d');
    if (context == null) {
      throw new Error('could not create canvas 2D context');
    }
    ctx = context;
  }
}
