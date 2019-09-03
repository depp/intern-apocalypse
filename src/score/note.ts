import { AssertionError } from '../debug/debug';

const middleC = 60;

const noteNames = new Map<string, number>([
  ['c', 0],
  ['d', 2],
  ['e', 4],
  ['f', 5],
  ['g', 7],
  ['a', 9],
  ['b', 11],
]);

/**
 * Parse a note written in scientific pitch notation, and return the MIDI value.
 */
export function parseNote(str: string): number | null {
  const match = /^([a-g])([#b]*)(-?\d+)$/.exec(str);
  if (!match) {
    return null;
  }
  let note = noteNames.get(match[1]);
  if (note == null) {
    throw new AssertionError('unknown note name');
  }
  for (const accidental of match[2]) {
    switch (accidental) {
      case '#':
        note++;
        break;
      case 'b':
        note--;
        break;
      default:
        throw new AssertionError('unknown accidental');
    }
  }
  const octave = parseInt(match[3], 10);
  return note + octave * 12 + (middleC - 48);
}
