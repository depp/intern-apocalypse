import { getModelNames } from '../model/models';
import { updateCamera } from '../game/camera';
import { modelInstances, ModelInstance, resetEntities } from '../game/entity';
import { renderModels } from '../render/model';
import {
  matrixNew,
  setIdentityMatrix,
  rotateMatrixFromAngle,
  Axis,
  scaleMatrix,
} from '../lib/matrix';
import { gl } from '../lib/global';
import { updateTime } from '../game/time';

/** The model being viewed. */
let model: ModelInstance | null;

/** Render a single model file. */
function render(curTimeMS: DOMHighResTimeStamp): void {
  if (model == null) {
    return;
  }
  updateTime(curTimeMS);
  updateCamera();
  const t = curTimeMS * 1e-3;
  const { transform } = model;
  setIdentityMatrix(transform);
  rotateMatrixFromAngle(transform, Axis.Z, t);
  rotateMatrixFromAngle(transform, Axis.X, 0.7 * t);
  scaleMatrix(transform, [3, 3, 3]);

  gl.clearColor(0.5, 0.5, 0.5, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  renderModels();
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.DEPTH_TEST);

  requestAnimationFrame(render);
}

/** Run a view of a single model file. */
export function runModelView(modelname: string): void {
  resetEntities();
  let modelnameLower = modelname.toLowerCase();
  const names = getModelNames();
  for (let i = 0; i < names.length; i++) {
    let name = names[i];
    const slash = name.lastIndexOf('/');
    if (slash != -1) {
      name = name.substring(slash + 1);
    }
    const dot = name.indexOf('.');
    if (dot != -1) {
      name = name.substring(0, dot);
    }
    if (name.toLocaleLowerCase() == modelnameLower) {
      console.log(`MODEL: ${i}`);
      model = {
        model: i,
        transform: matrixNew(),
      };
      modelInstances.push(model);
      requestAnimationFrame(render);
      return;
    }
  }
  console.error(`No such model: ${modelname}`);
}
