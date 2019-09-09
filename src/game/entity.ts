import { ModelAsset } from '../model/models';
import { Matrix } from '../lib/matrix';

/** Base interface for all entity types. */
export interface EntityBase {
  isDead?: boolean;
}

/** A game entity, which is rendered as a normal model. */
export interface ModelInstance extends EntityBase {
  /** The model asset to draw. */
  model: ModelAsset;
  /** Model transformation matrix. */
  transform: Matrix;
}

/** All model instances in the level. */
export let modelInstances: ModelInstance[];

/** Parameters for particle effects. */
export interface ParticlesParameters {
  /** Time at which particles start disappearing. */
  timeFull: number;
  /** Time at which all particles have disappeared. */
  timeGone: number;
  /** Delay before all particles start moving. */
  timeDelay: number;
  /** Acceleration by gravity, meters per second squared, divided by two. */
  gravity: number;
  /** Colors that the particles change to (two vec3). */
  colors: number[];
  /** Rate at which colors change. */
  colorRate: number;
  /** Initial particle count. */
  count: number;
}

/** A game entity, which is rendered as a particle effect instance. */
export interface ParticlesInstance extends EntityBase {
  /** The model asset to use for the particle template. */
  model: ModelAsset;
  /** Particle effect parameters. */
  parameters: ParticlesParameters;
  /** Model transformation matrix. */
  transform: Matrix;
  /** Particle effect animation time. */
  time: number;
  /** Particle movement initial velocity and dispersion (two vec3). */
  velocity: number[];
}

/** All particles instances in the level. */
export let particlesInstances: ParticlesInstance[];

/** A game entity, which gets processed every tick. */
export interface Entity extends EntityBase {
  /** Update the entity. Called every frame. */
  update(): void;
}
/** List of all active entities in the world. */
export let entities: Entity[];

/** Reset the entity system to make it ready for a new level. */
export function resetEntities(): void {
  entities = [];
  modelInstances = [];
  particlesInstances = [];
}
