import { getFile, watchFiles } from './files';
import { sounds, music } from '../audio/audio';
import { getSoundNames, getMusicNames } from '../audio/sounds';
import { SourceError, SourceText } from '../lib/sourcepos';
import { parseSExpr } from '../lib/sexpr';
import { evaluateProgram, soundParameters } from '../synth/evaluate';
import { emitCode } from '../synth/node';
import { hashVariables } from './hash';
import { logSourceError } from './source';
import { parseScore } from '../score/parse';
import { AssertionError } from './debug';

interface AssetInfo {
  index: number;
  filename: string;
  version: number;
}

let soundNameMap: Map<string, number> = new Map<string, number>();
let soundInfos: AssetInfo[] = [];
let musicInfos: AssetInfo[] = [];

/** Load a sound program from text format. */
function loadAudioProgram(filename: string, source: string): Uint8Array | null {
  try {
    const expr = parseSExpr(source);
    const node = evaluateProgram(expr, soundParameters);
    return emitCode(node);
  } catch (e) {
    if (e instanceof SourceError) {
      const text = new SourceText(filename, source);
      logSourceError(text, e);
      return null;
    }
    console.error(filename, e);
    return null;
  }
}

/** Update a single sound after files have been updated. */
function updateSound(info: AssetInfo): void {
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
    sound = loadAudioProgram(info.filename, file.data);
  }
  info.version = file.version;
  sounds[info.index] = sound;
}

/** Load a music score from text format. */
function loadMusicTrack(filename: string, source: string): Uint8Array | null {
  try {
    const score = parseScore(source);
    return score.emit(soundNameMap);
  } catch (e) {
    if (e instanceof SourceError) {
      const text = new SourceText(filename, source);
      logSourceError(text, e);
      return null;
    }
    console.error(filename, e);
    return null;
  }
}

/** Update a single music track after files have been updated. */
function updateMusic(info: AssetInfo): void {
  const file = getFile(info.filename);
  if (file.version == info.version) {
    return;
  }

  if (hashVariables.logAssets) {
    console.log(`Loading ${info.filename}`);
  }
  let code: Uint8Array | null;
  if (file.data == null) {
    code = null;
  } else {
    code = loadMusicTrack(info.filename, file.data);
  }
  info.version = file.version;
  music[info.index] = code;
}

/** Respond to files being received over the web socket. */
function filesChanged(): void {
  for (const info of soundInfos) {
    updateSound(info);
  }
  for (const info of musicInfos) {
    updateMusic(info);
  }
}

/** Load sounds from data files received over the web socket. */
export function watchSounds(): void {
  soundNameMap.clear();
  soundInfos.length = 0;
  musicInfos.length = 0;
  const soundNames = getSoundNames();
  for (let index = 0; index < soundNames.length; index++) {
    const filename = soundNames[index];
    const match = /^audio\/(.*?)\./.exec(filename);
    if (!match) {
      throw new AssertionError('bad name', { filename });
    }
    soundNameMap.set(match[1].toLowerCase(), index);
    soundInfos.push({ index, filename, version: 0 });
  }
  const musicNames = getMusicNames();
  for (let index = 0; index < musicNames.length; index++) {
    const filename = musicNames[index];
    musicInfos.push({ index, filename, version: 0 });
  }
  watchFiles(filesChanged);
}
