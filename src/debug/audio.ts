import { getFile, watchFiles } from './files';
import { sounds } from '../audio/audio';
import { getSoundNames } from '../audio/sounds';
import { SourceError, SourceText } from '../lib/sourcepos';
import { parseSExpr } from '../lib/sexpr';
import { evaluateProgram, soundParameters } from '../synth/evaluate';
import { emitCode } from '../synth/node';
import { hashVariables } from './hash';
import { logSourceError } from './source';

interface SoundInfo {
  index: number;
  filename: string;
  version: number;
}

let soundInfos: SoundInfo[] = [];

/** Load a sound program from text format. */
function loadAudioProgram(filename: string, source: string): Uint8Array | null {
  let code: Uint8Array;
  try {
    const expr = parseSExpr(source);
    const node = evaluateProgram(expr, soundParameters);
    code = emitCode(node);
  } catch (e) {
    if (e instanceof SourceError) {
      const text = new SourceText(filename, source);
      logSourceError(text, e);
      return null;
    }
    console.error(filename, e);
    return null;
  }
  return code;
}

/** Update a single sound after files have been updated. */
function update(info: SoundInfo): void {
  const file = getFile(info.filename);
  if (file.version == info.version) {
    return;
  }

  if (hashVariables.logAssets) {
    console.log(`Loading ${info.filename}`);
  }
  let sound: Uint8Array | null;
  if (file.data == null) {
    sound = null;
  } else {
    try {
      sound = loadAudioProgram(info.filename, file.data);
    } catch (e) {
      console.error(e);
      sound = null;
    }
  }
  info.version = file.version;
  sounds[info.index] = sound;
}

/** Respond to files being received over the web socket. */
function filesChanged(): void {
  for (const info of soundInfos) {
    update(info);
  }
}

/** Load sounds from data files received over the web socket. */
export function watchSounds(): void {
  const soundNames = getSoundNames();
  soundInfos = [];
  for (let index = 0; index < soundNames.length; index++) {
    const filename = soundNames[index];
    soundInfos.push({ index, filename, version: 0 });
  }
  watchFiles(filesChanged);
}
