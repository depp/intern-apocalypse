import { GenModel } from '../model/genmodel';
import { Level } from './level';

export let currentLevel: LevelObject;
export let nextLevel: number | undefined;

export interface LevelObject {
  levelModel: GenModel;
  level: Level;
  exits: (number | undefined)[];
  spawn(): void;
}

export function setLevel(newLevel: LevelObject): void {
  nextLevel = -1;
  currentLevel = newLevel;
  newLevel.spawn();
}

export function setNextLevel(index: number): void {
  nextLevel = index;
}
