import { getFile, watchFiles } from './files';
import { loadModel, unloadModel, Model } from '../model/model';
import { models, getModelNames } from '../model/models';
import { convertModel } from '../model/convert';
import { SourceError, SourceText } from '../lib/sourcepos';

interface ModelInfo {
  index: number;
  filename: string;
  version: number;
}

let modelInfos: ModelInfo[] = [];

/** Load a model from text format. */
function loadTextModel(filename: string, source: string): Model | null {
  let converted: Uint8Array;
  try {
    converted = convertModel(source);
  } catch (e) {
    if (e instanceof SourceError) {
      const text = new SourceText(filename, source);
      const loc = text.lookup(e.sourceStart);
      console.error(`${filename}:${loc.lineno}:${loc.colno} ${e.message}`);
      return null;
    }
    console.error(filename, e);
    return null;
  }
  return loadModel(converted);
}

/** Update a single model after files have been updated. */
function update(info: ModelInfo): void {
  const file = getFile(info.filename);
  if (file.version == info.version) {
    return;
  }
  let model: Model | null;
  if (file.data == null) {
    model = null;
  } else {
    try {
      model = loadTextModel(info.filename, file.data);
    } catch (e) {
      console.error(e);
      model = null;
    }
  }
  info.version = file.version;
  const oldModel = models[info.index];
  if (oldModel != null) {
    unloadModel(oldModel);
  }
  models[info.index] = model;
}

/** Respond to files being received over the web socket. */
function filesChanged(): void {
  for (const info of modelInfos) {
    update(info);
  }
}

/** Load models from data files received over the web socket. */
export function watchModels(): void {
  const modelNames = getModelNames();
  modelInfos = [];
  for (let index = 0; index < modelNames.length; index++) {
    const filename = modelNames[index];
    modelInfos.push({ index, filename, version: 0 });
  }
  watchFiles(filesChanged);
}
