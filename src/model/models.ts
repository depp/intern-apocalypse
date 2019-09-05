/* This code is automatically generated. */

import { Model } from './model';

/** Model asset identifiers. */
export const enum Models {
  Person,
  Sword,
}

/** Loaded models. */
export const models: (Model | null)[] = [];

/** Get list of model filenames, in order. */
export function getModelNames(): string[] {
  return ['model/person.txt', 'model/sword.txt'];
}
