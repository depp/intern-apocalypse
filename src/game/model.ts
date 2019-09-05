import { ModelAsset } from '../model/models';
import { Matrix } from '../lib/matrix';

/** An instance of a model, to be drawn somewhere in the world. */
export interface ModelInstance {
  /** The model asset to draw. */
  model: ModelAsset;
  /** Model transformation matrix. */
  transform: Matrix;
}

export const modelInstances: ModelInstance[] = [];
