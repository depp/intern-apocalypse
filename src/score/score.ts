import { Opcode, signedOffset } from './opcode';
import { AssertionError, isDebug } from '../debug/debug';
import { runProgram } from '../synth/engine';
import { roundUpPow2 } from '../lib/util';
import { sampleRate } from '../lib/audio';
import { decodeExponential } from '../synth/data';

/** Render a musical score to an audio buffer. */
export function renderScore(
  program: Uint8Array,
  sounds: (Uint8Array | null)[],
): Float32Array {
  const dataChunks: Uint8Array[] = [new Uint8Array()];
  let pos = 0;
  let size: number;
  if (program.length == 0) {
    throw new AssertionError('empty program');
  }
  while ((size = program[pos++])) {
    // Note >=, because we test for the next loop too.
    if (size >= program.length - pos) {
      throw new AssertionError('end of program');
    }
    dataChunks.push(program.slice(pos, pos + size));
    pos += size;
  }
  let result = new Float32Array();
  let synthProgram: Uint8Array | null | undefined;
  let time: number | undefined;
  let resultLength = 0;
  // Duration of 1/6th of a sixteenth note, in seconds.
  let baseDuration = 0;
  // Duration of the score, in samples.
  let scoreDuration = 0;
  // Current transposition value offset.
  let transposition = 0;
  // Current inversion.
  let inversion = 0;
  // Whether to reverse the values.
  let reverse = false;
  // Track level.
  let level: number | undefined;
  while (pos < program.length) {
    const opcode = program[pos++];
    switch (opcode) {
      case Opcode.Track:
        if (pos + 2 > program.length) {
          throw new AssertionError('end of program');
        }
        const soundIndex = program[pos++];
        if (soundIndex >= sounds.length) {
          throw new AssertionError('sound index out of range');
        }
        level = decodeExponential(program[pos++]);
        synthProgram = sounds[soundIndex];
        time = 0;
        transposition = 0;
        inversion = 0;
        reverse = false;
        break;

      case Opcode.Tempo:
        const tempo = 50 + 2 * program[pos++];
        baseDuration = 60 / (6 * 4) / tempo;
        break;

      case Opcode.Transpose:
        if (pos >= program.length) {
          throw new AssertionError('end of program');
        }
        transposition = program[pos++] - signedOffset;
        break;

      case Opcode.Inversion:
        if (pos >= program.length) {
          throw new AssertionError('end of program');
        }
        inversion = program[pos++];
        break;

      case Opcode.Reverse:
        reverse = !reverse;
        break;

      case Opcode.Skip:
        if (time == null) {
          throw new AssertionError('null time');
        }
        if (pos >= program.length) {
          throw new AssertionError('end of program');
        }
        const skipValue = program[pos++];
        time += skipValue * baseDuration * 16 * 6;
        break;

      default:
        if (time == null) {
          throw new AssertionError('time == null');
        }
        if (level == null) {
          throw new AssertionError('level == null');
        }
        // Get rhythm pattern
        const patternIndex = opcode - Opcode.Notes;
        if (patternIndex >= dataChunks.length) {
          throw new AssertionError('invalid pattern');
        }
        const notes = dataChunks[patternIndex];
        // Get note values
        if (pos >= program.length) {
          throw new AssertionError('end of program');
        }
        const valueIndex = program[pos++];
        if (valueIndex >= dataChunks.length) {
          throw new AssertionError('invalid values');
        }
        const values = new Uint8Array(dataChunks[valueIndex]);
        const chromaticity = values.map(x => x % 12);
        for (let i = 0; i < inversion; i++) {
          let newValue = values[values.length - 1];
          for (let j = 1; j < 13; j++) {
            if (chromaticity.includes((newValue + j) % 12)) {
              newValue += j;
              break;
            }
          }
          values.copyWithin(0, 1);
          values[values.length - 1] = newValue;
        }
        if (reverse) {
          values.reverse();
        }
        const patternStart = time;
        for (const note of notes) {
          if (note >= 90) {
            time = patternStart;
            continue;
          }
          let index = note % 6;
          const modifier = (note / 6) % 3 | 0;
          const base = note / 18;
          // Durations: A sixteenth note has a duration of 6. This lets us just
          // use integers and multiplication here.
          const duration = baseDuration * ([6, 9, 4][modifier] << base);
          const start = (time * sampleRate) | 0;
          time += duration;
          if (!synthProgram || !index) {
            continue;
          }
          const value = values[index - 1];
          if (!value) {
            continue;
          }
          const noteAudio = runProgram(
            synthProgram,
            value + transposition,
            duration,
          );
          const end = start + noteAudio.length;
          resultLength = Math.max(resultLength, end);
          scoreDuration = Math.max(scoreDuration, end);
          if (end > result.length) {
            const oldbuf = result;
            result = new Float32Array(roundUpPow2(end));
            result.set(oldbuf);
          }
          for (let i = 0; i < noteAudio.length; i++) {
            result[start + i] += noteAudio[i] * level;
          }
        }
        break;
    }
  }
  return result.subarray(0, resultLength);
}
