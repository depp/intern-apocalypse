import { GenModel } from '../model/genmodel';
import * as genmodel from '../model/genmodel';
import { Level } from './level';

export let levelModel: GenModel;
export let level: Level;

export interface LevelObject {
  levelModel?: GenModel;
  level: Level;
  spawn(): void;
}

export function setLevel(newLevel: LevelObject): void {
  levelModel =
    newLevel.levelModel || (newLevel.levelModel = genmodel.newModel());
  level = newLevel.level;
  newLevel.spawn();
}
