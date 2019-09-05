import { ModelAsset } from '../model/models';

/** An instance of a model, to be drawn somewhere in the world. */
export interface ModelInstance {
  /** The model asset to draw. */
  model: ModelAsset;
  /** Model origin, 3D vector. */
  pos: Float32Array;
  /** Angle the model is facing on the XY plane (0 = +X). */
  angle: number;
}

export const modelInstances: ModelInstance[] = [];
