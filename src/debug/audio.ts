import { watchFile } from './files';
import { getSoundNames, getMusicNames, firstMusicTrack } from '../audio/sounds';
import { SourceError, SourceText } from '../lib/sourcepos';
import { parseSExpr } from '../lib/sexpr';
import { evaluateProgram, soundParameters } from '../synth/evaluate';
import { emitCode } from '../synth/node';
import { hashVariables } from './hash';
import { logSourceError } from './source';
import { parseScore } from '../score/parse';
import { AssertionError } from './debug';
import { sendMessage } from './worker';

interface AssetInfo {
  index: number;
  filename: string;
  isDirty: boolean;
  source: string | null;
}

let soundNameMap: Map<string, number> = new Map<string, number>();

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

function updateAsset(info: AssetInfo) {
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
  let data: Uint8Array | null;
  if (index < firstMusicTrack) {
    data = loadAudioProgram(filename, source);
  } else {
    data = loadMusicTrack(filename, source);
  }
  sendMessage({ kind: 'audio-program', index, data });
}

function watchAsset(index: number, filename: string): void {
  const info: AssetInfo = {
    index,
    filename,
    isDirty: false,
    source: null,
  };
  watchFile(filename, data => {
    if (data != info.source) {
      info.source = data;
      info.isDirty = true;
      setTimeout(() => updateAsset(info));
    }
  });
}

/** Load sounds from data files received over the web socket. */
export function watchSounds(): void {
  soundNameMap.clear();
  const soundNames = getSoundNames();
  for (let index = 0; index < soundNames.length; index++) {
    const filename = soundNames[index];
    watchAsset(index, soundNames[index]);
    const match = /^audio\/(.*?)\./.exec(filename);
    if (!match) {
      throw new AssertionError('bad name', { filename });
    }
    soundNameMap.set(match[1].toLowerCase(), index);
  }
  const musicNames = getMusicNames();
  for (let index = 0; index < musicNames.length; index++) {
    watchAsset(index + firstMusicTrack, musicNames[index]);
  }
}
