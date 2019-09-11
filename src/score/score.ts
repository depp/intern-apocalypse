import { Opcode } from './opcode';
import { AssertionError } from '../debug/debug';
import { sampleRate, runProgram } from '../synth/engine';
import { roundUpPow2 } from '../lib/util';

/** Render a musical score to an audio buffer. */
export function renderScore(
  program: Uint8Array,
  sounds: Uint8Array[],
): Float32Array {
  let result = new Float32Array();
  let synthProgram: Uint8Array | null | undefined;
  const patterns: Uint8Array[] = [];
  let pos = 0;
  let time: number | undefined;
  // Duration of 1/6th of a sixteenth note, in seconds.
  let baseDuration = 0;
  // Duration of the score, in samples.
  let scoreDuration = 0;
  while (pos < program.length) {
    const opcode = program[pos++];
    switch (opcode) {
      case Opcode.Track:
        if (pos + 2 > program.length) {
          throw new AssertionError('end of program');
        }
        pos++; // Track index.
        const soundIndex = program[pos++];
        if (soundIndex >= sounds.length) {
          throw new AssertionError('sound index out of range');
        }
        synthProgram = sounds[soundIndex];
        time = 0;
        break;

      case Opcode.Pattern:
        if (pos >= program.length) {
          throw new AssertionError('end of program');
        }
        const patternLength = program[pos++];
        if (pos + patternLength > program.length) {
          throw new AssertionError('end of program');
        }
        patterns.push(program.slice(pos, pos + patternLength));
        pos += patternLength;
        break;

      case Opcode.Tempo:
        const tempo = 50 + 2 * program[pos++];
        baseDuration = 60 / (6 * 4) / tempo;
        break;

      default:
        if (time == null) {
          throw new AssertionError('time == null');
        }
        const patternIndex = opcode - Opcode.Notes;
        if (patternIndex >= patterns.length) {
          throw new AssertionError('invalid pattern');
        }
        let patternSize = 0;
        for (const note of patterns[patternIndex]) {
          let index = note % 6;
          const modifier = (note / 6) % 3 | 0;
          const base = note / 18;
          // Durations: A sixteenth note has a duration of 6. This lets us just
          // use integers and multiplication here.
          const duration = baseDuration * ([6, 9, 4][modifier] << base);
          const start = (time * sampleRate) | 0;
          time += duration;
          if (index) {
            patternSize = Math.max(patternSize, index);
            if (index - 1 > program.length - pos) {
              throw new AssertionError('end of program', { index });
            }
            const value = program[pos + index - 1];
            if (!synthProgram) {
              continue;
            }
            const noteAudio = runProgram(synthProgram, value, duration);
            const end = start + noteAudio.length;
            scoreDuration = Math.max(scoreDuration, end);
            if (end > result.length) {
              const oldbuf = result;
              result = new Float32Array(roundUpPow2(end));
              result.set(oldbuf);
            }
            for (let i = 0; i < noteAudio.length; i++) {
              result[start + i] += noteAudio[i];
            }
          }
        }
        pos += patternSize;
        break;
    }
  }
  if (time == null) {
    throw new AssertionError('empty score');
  }
  return result.subarray(0, (time * sampleRate) | 0);
}
