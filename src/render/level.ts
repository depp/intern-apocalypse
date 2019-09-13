/**
 * Level geometry renderer.
 */

import { Random } from '../lib/random';
import { Edge } from '../game/level';
import * as genmodel from '../model/genmodel';
import { packColor } from './util';
import { currentLevel } from '../game/campaign';

/** See levelVersion. */
let geometryVersion = 0;

const random = new Random(9876);

/**
 * Create the level geometry.
 */
function createGeometry(): void {
  genmodel.start3D();
  const wallHeight = 0.7;
  for (const cell of currentLevel.level.cells) {
    genmodel.setColor(cell.color || 0);
    const { height } = cell;
    const edges: Readonly<Edge>[] = Array.from(cell.edges());
    const n = edges.length;
    genmodel.startFace();
    for (let i = 0; i < n; i++) {
      const v = edges[i].vertex0;
      genmodel.addVertex([v.x, v.y, height]);
    }
    genmodel.endFace();
    for (const edge of edges) {
      const { back } = edge;
      if (back && back.cell.height < height) {
        const height2 = back.cell.height;
        const { vertex0, vertex1 } = edge;
        genmodel.startFace();
        genmodel.addVertex([
          vertex0.x,
          vertex0.y,
          height2,
          vertex1.x,
          vertex1.y,
          height2,
          vertex1.x,
          vertex1.y,
          height,
          vertex0.x,
          vertex0.y,
          height,
        ]);
        genmodel.endFace();
      }
    }
  }
  genmodel.upload(currentLevel.levelModel);
}

/** Update the level renderer. */
export function updateRenderLevel(): void {
  if (!currentLevel.levelModel.vcount) {
    createGeometry();
  }
}
