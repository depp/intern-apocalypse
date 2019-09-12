import { watchFile } from './files';
import { loadModel, unloadModel, Model, models } from '../model/model';
import { getModelNames } from '../model/models';
import { convertModel } from '../model/convert';
import { SourceError, SourceText } from '../lib/sourcepos';
import { hashVariables } from './hash';
import { logSourceError } from './source';

interface ModelInfo {
  index: number;
  filename: string;
  isDirty: boolean;
  source: string | null;
}

/** Load a model from text format. */
function loadTextModel(filename: string, source: string): Model | null {
  let converted: Uint8Array;
  try {
    converted = convertModel(source);
  } catch (e) {
    if (e instanceof SourceError) {
      const text = new SourceText(filename, source);
      logSourceError(text, e);
      return null;
    }
    console.error(filename, e);
    return null;
  }
  return loadModel(converted);
}

/** Update a single model after files have been updated. */
function updateModel(info: ModelInfo): void {
  if (!info.isDirty) {
    return;
  }
  info.isDirty = false;
  const { index, filename, source } = info;
  if (!source) {
    return;
  }
  if (hashVariables.logAssets) {
    console.log(`Loading ${info.filename}`);
  }
  const model = loadTextModel(filename, source);
  const old = models[index];
  if (old) {
    unloadModel(old);
  }
  models[index] = model;
}

function watchModel(index: number, filename: string): void {
  const info: ModelInfo = {
    index,
    filename,
    isDirty: false,
    source: null,
  };
  watchFile(filename, data => {
    if (data != info.source) {
      info.source = data;
      info.isDirty = true;
      setTimeout(() => updateModel(info));
    }
  });
}

/** Load models from data files received over the web socket. */
export function watchModels(): void {
  const modelNames = getModelNames();
  for (let index = 0; index < modelNames.length; index++) {
    watchModel(index, modelNames[index]);
  }
}
