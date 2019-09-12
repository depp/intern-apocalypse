import {
  parseNoteValue,
  middleC,
  NoteValue,
  NoteRhythm,
  DurationModifier,
  parseRhythm,
  RhythmKind,
} from './parse';
import { SourceError } from '../lib/sourcepos';
import { Chunk } from '../lib/textdata';

test('parseNoteValue', () => {
  // These are MIDI values.
  const cases: [string, number][] = [
    ['c4', 60],
    ['c#4', 61],
    ['db4', 61],
    ['d4', 62],
    ['e4', 64],
    ['f4', 65],
    ['g4', 67],
    ['a4', 69],
    ['b4', 71],
    ['c5', 72],
    ['c3', 48],
  ];
  for (const [input, midi] of cases) {
    // Convert from
    const expected = midi + middleC - 60;
    let output: NoteValue;
    try {
      output = parseNoteValue({ text: input, sourcePos: -1 });
    } catch (e) {
      if (e instanceof SourceError) {
        throw new Error(
          `parseNoteValue(${JSON.stringify(input)}): error: ` + e.message,
        );
      }
      throw e;
    }
    const { value } = output;
    if (value != expected) {
      throw new Error(
        `parseNoteValue(${JSON.stringify(input)}) = ${JSON.stringify(
          value,
        )}, ` + `want ${JSON.stringify(expected)}`,
      );
    }
  }
});

test('parseNoteRhythm', () => {
  interface Case {
    input: Chunk;
    expected: NoteRhythm;
  }
  let curPos = 0;
  function c(
    text: string,
    baseDuration: number,
    durationModifier: DurationModifier,
    noteIndex: number | null,
  ): Case {
    const sourcePos = curPos;
    curPos += text.length + 1;
    return {
      input: { text, sourcePos: curPos },
      expected: {
        kind: RhythmKind.Note,
        sourceStart: sourcePos,
        sourceEnd: sourcePos + text.length,
        baseDuration,
        durationModifier,
        noteIndex,
      },
    };
  }
  const { None, Dotted, Triplet } = DurationModifier;
  const cases: Case[] = [
    c('w1', 0, None, 1),
    c('h12', 1, None, 12),
    c('q5', 2, None, 5),
    c('e.3', 3, Dotted, 3),
    c('s1', 4, None, 1),
    c('st1', 4, Triplet, 1),
    c('q.r', 2, Dotted, null),
  ];
  function show(r: NoteRhythm): string {
    let s = `(`;
    s += r.baseDuration;
    s += ',';
    s += DurationModifier[r.durationModifier];
    s += ',';
    s += r.noteIndex;
    return s + ')';
  }
  for (const { input, expected } of cases) {
    const output = parseRhythm(input);
    if (
      output.baseDuration != expected.baseDuration ||
      output.durationModifier != expected.durationModifier ||
      output.noteIndex != expected.noteIndex
    ) {
      throw new Error(
        `parseNoteRhythm(${JSON.stringify(input)}) = ` +
          `${show(output)}, want ${show(expected)}`,
      );
    }
  }
});
