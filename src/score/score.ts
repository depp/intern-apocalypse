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
  const synthProgram = sounds[0];
  const patterns: Uint8Array[] = [];
  let pos = 0;
  const tempo = 120;
  let time = 0;
  // Duration of 1/6th of a sixteenth note, in seconds.
  let baseDuration = 60 / (6 * 4) / tempo;
  // Duration of the score, in samples.
  let scoreDuration = 0;
  while (pos < program.length) {
    const opcode = program[pos++];
    switch (opcode) {
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

      default:
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
  return result.subarray(0, (time * sampleRate) | 0);
}
