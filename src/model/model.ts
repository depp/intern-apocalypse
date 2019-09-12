/**
 * 3D model loading code.
 */

import { Opcode } from './defs';
import { AssertionError } from '../debug/debug';
import { dataMax, decodeExponential, decode } from '../lib/data.encode';
import { clamp } from '../lib/util';
import { modelOffset } from '../lib/loader';
import { GenModel } from './genmodel';
import * as genmodel from './genmodel';
import { newVector3 } from './util';

/** A loaded model. */
export interface Model {
  mesh: GenModel;
  particles: GenModel;
}

/** Load a model from a binary stream. */
export function loadModel(data: Uint8Array): Model {
  let pos = 7 + data[0] * 3;
  const scale = new Float32Array(data.slice(4, 7)).map(decodeExponential);
  const vertexPos = newVector3();
  let color = 0;
  let symmetry = 0;
  genmodel.start3D();
  while (pos < data.length) {
    switch (data[pos++]) {
      case Opcode.Symmetry:
        symmetry = data[pos++];
        break;
      case Opcode.Color:
        color = 0;
        for (let i = 0; i < 3; i++) {
          color |=
            clamp((data[pos++] * 256) / (dataMax + 1), 0, 255) << (i * 8);
        }
        genmodel.setColor(color);
        break;
      default:
        let size = data[pos - 1] + (3 - Opcode.Face3);
        if (size < 3) {
          throw new AssertionError(`invalid model opcode: ${data[pos - 1]}`);
        }
        let faceSymmetry = symmetry;
        let savePos = pos;
        for (let reflection = 0; reflection < 8; reflection++) {
          if (reflection & ~faceSymmetry) {
            continue;
          }
          pos = savePos;
          let parity = (0b10010110 >> reflection) & 1;
          genmodel.startFace();
          for (let vertex = 0; vertex < size; vertex++) {
            let index = data[pos++];
            let flags = 0;
            if (index > dataMax - 8) {
              flags = index - (dataMax - 7);
              index = data[pos++];
            }
            if (index >= data[0]) {
              throw new AssertionError(`point out of range: ${index}`);
            }
            for (let axis = 0; axis < 3; axis++) {
              let value =
                scale[axis] * (data[7 + index * 3 + axis] - data[axis + 1]);
              if ((flags ^ reflection) & (1 << axis)) {
                value = -value;
              }
              vertexPos[axis] = value;
            }
            genmodel.addVertex(vertexPos);
            faceSymmetry &= ~flags;
          }
          genmodel.endFace(parity);
        }
        break;
    }
  }
  const mesh = genmodel.newModel();
  genmodel.upload(mesh);
  const particles = genmodel.newModel();
  genmodel.uploadParticles(particles);
  return { mesh, particles };
}

/** Unload a loaded model. */
export function unloadModel(model: Model): void {
  genmodel.destroy(model.mesh);
  genmodel.destroy(model.particles);
}

/** Loaded models. */
export let models: (Model | null)[] = [];

/** Load all models embedded in the release build. */
export function loadModels(data: readonly string[]): void {
  models = data[modelOffset].split(' ').map(x => loadModel(decode(x)));
}
