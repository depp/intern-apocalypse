/**
 * Level geometry renderer.
 */

import { Random } from '../lib/random';
import { Edge } from '../game/level';
import * as genmodel from '../model/genmodel';
import { packColor } from './util';
import { level, levelModel } from '../game/campaign';

/** See levelVersion. */
let geometryVersion = 0;

const random = new Random(9876);

function cellColor(walkable: boolean): number {
  const luminance =
    random.range(0.2, 0.4) + ((walkable as unknown) as number) * 0.6;
  return packColor(luminance, luminance, luminance);
}

/**
 * Create the level geometry.
 */
function createGeometry(): void {
  genmodel.start3D();
  const wallHeight = 0.7;
  for (const cell of level.cells) {
    genmodel.setColor(cell.color || cellColor(cell.walkable));
    const z = ((!cell.walkable as unknown) as number) * wallHeight;
    const edges: Readonly<Edge>[] = Array.from(cell.edges());
    const n = edges.length;
    genmodel.startFace();
    for (let i = 0; i < n; i++) {
      const v = edges[i].vertex0;
      genmodel.addVertex([v.x, v.y, z]);
    }
    genmodel.endFace();
    if (!cell.walkable) {
      for (const edge of edges) {
        const { back } = edge;
        if (back && back.cell!.walkable) {
          const { vertex0, vertex1 } = edge;
          genmodel.startFace();
          genmodel.addVertex([
            vertex0.x,
            vertex0.y,
            0,
            vertex1.x,
            vertex1.y,
            0,
            vertex1.x,
            vertex1.y,
            z,
            vertex0.x,
            vertex0.y,
            z,
          ]);
          genmodel.endFace();
        }
      }
    }
  }
  genmodel.upload(levelModel);
}

/** Update the level renderer. */
export function updateRenderLevel(): void {
  if (!levelModel.vcount) {
    createGeometry();
  }
}
