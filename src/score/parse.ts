import { AssertionError } from '../debug/debug';
import { Chunk, splitLines, splitFields, chunkEnd } from '../lib/textdata';
import { SourceError, SourceSpan, HasSourceLoc } from '../lib/sourcepos';
import { DataWriter } from '../lib/data.writer';
import { Opcode } from './opcode';

// =============================================================================
// Base data types
// =============================================================================

/**
 * The note value of middle C, C4.
 *
 * This is shifted from MIDI values.
 */
export const middleC = 48;

const noteNames = new Map<string, number>([
  ['c', 0],
  ['d', 2],
  ['e', 4],
  ['f', 5],
  ['g', 7],
  ['a', 9],
  ['b', 11],
]);

/** The value part of a note. */
export interface NoteValue extends SourceSpan {
  value: number;
}

/**
 * Parse a note written in scientific pitch notation, and return the MIDI value.
 */
export function parseNoteValue(chunk: Chunk): NoteValue {
  const match = /^([a-g])([#b]*)(-?\d+)$/i.exec(chunk.text);
  if (!match) {
    throw new SourceError(chunk, 'invalid note value');
  }
  const [, baseNote, accidental, octaveText] = match;
  let note = noteNames.get(baseNote.toLowerCase());
  if (note == null) {
    throw new AssertionError('unknown note name');
  }
  for (const item of accidental) {
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
  const octave = parseInt(octaveText, 10);
  const value = note + octave * 12 + (middleC - 48);
  if (!isFinite(value)) {
    throw new AssertionError('note overflow');
  }
  return {
    sourceStart: chunk.sourcePos,
    sourceEnd: chunkEnd(chunk),
    value,
  };
}

/** Modifiers to base duration values. */
export enum DurationModifier {
  None,
  Dotted,
  Triplet,
}

/** The rhythm part of a note. */
export interface NoteRhythm extends SourceSpan {
  /**
   * Base value, exponential. 0 = whole note, 1 = half note, 2 = quarter, etc.
   */
  baseDuration: number;

  /** Modifier to the base duration value. */
  durationModifier: DurationModifier;

  /** Note to play, or null for rest. */
  noteIndex: number | null;
}

const baseDurationNames: readonly string[] = ['w', 'h', 'q', 'e', 's'];

/** Parse the rhythm component of a note. */
export function parseRhythm(chunk: Chunk): NoteRhythm {
  const match = /^([a-z])([.t]?)([0-9]+|r)$/.exec(chunk.text);
  if (!match) {
    throw new SourceError(chunk, 'empty rhythm');
  }
  const [, baseText, modText, noteText] = match;
  const baseDuration = baseDurationNames.indexOf(baseText.toLowerCase());
  if (baseDuration == -1) {
    throw new SourceError(
      { text: baseText, sourcePos: chunk.sourcePos },
      `invalid base duration ${JSON.stringify(baseText)}`,
    );
  }
  let durationModifier: DurationModifier;
  switch (modText.toLowerCase()) {
    case '':
      durationModifier = DurationModifier.None;
      break;
    case '.':
      durationModifier = DurationModifier.Dotted;
      break;
    case 't':
      durationModifier = DurationModifier.Triplet;
      break;
    default:
      throw new AssertionError('unknown duration modifier');
  }
  let noteIndex: number | null;
  if (noteText.toLowerCase() == 'r') {
    noteIndex = null;
  } else {
    noteIndex = parseInt(noteText, 10);
    if (noteIndex == 0) {
      throw new SourceError(
        {
          text: noteText,
          sourcePos: chunk.sourcePos + baseText.length + modText.length,
        },
        'note index 0 is invalid',
      );
    }
    if (!isFinite(noteIndex)) {
      throw new SourceError(
        {
          text: noteText,
          sourcePos: chunk.sourcePos + baseText.length + modText.length,
        },
        `could not parse note index ${JSON.stringify(noteText)}`,
      );
    }
  }
  return {
    sourceStart: chunk.sourcePos,
    sourceEnd: chunkEnd(chunk),
    baseDuration,
    durationModifier,
    noteIndex,
  };
}

// =============================================================================
// Score elements
// =============================================================================

/** Kinds of items in the score. */
enum Kind {
  Pattern,
  EmittedPattern,
  Notes,
}

/** Base type for items in a parsed score. */
interface ItemBase {
  kind: Kind;
  loc: SourceSpan;
}

interface Pattern extends ItemBase {
  kind: Kind.Pattern;
  name: Chunk;
  notes: NoteRhythm[];
}

interface EmittedPattern {
  kind: Kind.EmittedPattern;
  index: number;
  /** Number of note values required. */
  size: number;
}

interface Notes extends ItemBase {
  kind: Kind.Notes;
  patternName: Chunk;
  notes: NoteValue[];
}

type Item = Pattern | Notes;

// =============================================================================
// Score parsing
// =============================================================================

type ItemParser = (loc: SourceSpan, fields: Chunk[]) => Item;

const itemTypes = new Map<string, ItemParser>();

/** Define a score item type. */
function deftype(name: string, parser: ItemParser): void {
  if (itemTypes.has(name)) {
    throw new AssertionError(`duplicate name ${JSON.stringify(name)}`);
  }
  itemTypes.set(name, parser);
}

/** Parse a note pattern. */
deftype('pattern', function parsePattern(loc, fields): Pattern {
  if (fields.length < 1) {
    throw new SourceError(
      loc,
      `pattern requires at least 1 field, got ${fields.length}`,
    );
  }
  const notes: NoteRhythm[] = [];
  for (let i = 1; i < fields.length; i++) {
    notes.push(parseRhythm(fields[i]));
  }
  return {
    kind: Kind.Pattern,
    loc,
    name: fields[0],
    notes,
  };
});

deftype('notes', function parseNotes(loc, fields): Notes {
  if (fields.length < 1) {
    throw new SourceError(
      loc,
      `notes requires at least 1 field, got ${fields.length}`,
    );
  }
  const patternName = fields[0].text;
  const notes: NoteValue[] = [];
  for (let i = 1; i < fields.length; i++) {
    notes.push(parseNoteValue(fields[i]));
  }
  return {
    kind: Kind.Notes,
    loc,
    patternName: fields[0],
    notes,
  };
});

function parseScoreItems(source: string): Item[] {
  const items: Item[] = [];
  for (const line of splitLines(source)) {
    const fields = splitFields(line);
    if (fields.length == 0) {
      continue;
    }
    const loc = {
      sourceStart: fields[0].sourcePos,
      sourceEnd: chunkEnd(fields[fields.length - 1]),
    };
    const head = fields.shift()!;
    const parser = itemTypes.get(head.text);
    if (parser == null) {
      throw new SourceError(
        head,
        `unknown item type ${JSON.stringify(head.text)}`,
      );
    }
    items.push(parser(loc, fields));
  }
  return items;
}

// =============================================================================
// Score conversion
// =============================================================================

/** The state of a score being written. */
interface ScoreWriter {
  output: DataWriter;
  patterns: Map<string, Pattern | EmittedPattern>;
  nextPatternIndex: number;
}

function addPattern(w: ScoreWriter, item: Pattern): void {
  if (w.patterns.has(item.name.text)) {
    throw new SourceError(
      item.name,
      `duplicate pattern name ${JSON.stringify(item.name.text)}`,
    );
  }
  w.patterns.set(item.name.text, item);
}

function writeNoteRhythm(w: ScoreWriter, note: NoteRhythm): void {
  const { baseDuration, durationModifier, noteIndex } = note;
  let value = 0;
  // Duration
  value *= 5;
  if (baseDuration < 0 || 4 < baseDuration) {
    throw new AssertionError('invalid baseDuration', { baseDuration });
  }
  value += 4 - baseDuration;
  // Modifier
  value *= 3;
  if (durationModifier < 0 || 2 < durationModifier) {
    throw new AssertionError('invalid durationModifier', { durationModifier });
  }
  value += durationModifier;
  // Note index
  value *= 6;
  if (noteIndex != null) {
    if (noteIndex < 1) {
      throw new AssertionError('invalid note duration');
    }
    if (noteIndex > 5) {
      throw new SourceError(note, `note index out of range`);
    }
    value += noteIndex;
  }
  // Output
  w.output.write(value);
}

function writePattern(w: ScoreWriter, item: Pattern): EmittedPattern {
  const { name, notes } = item;
  const index = w.nextPatternIndex++;
  w.output.write(Opcode.Pattern, notes.length);
  let size = 0;
  for (const note of notes) {
    if (note.noteIndex != null) {
      size = Math.max(size, note.noteIndex);
    }
    writeNoteRhythm(w, note);
  }
  const value: EmittedPattern = {
    kind: Kind.EmittedPattern,
    index,
    size,
  };
  w.patterns.set(name.text, value);
  return value;
}

function getPattern(w: ScoreWriter, name: Chunk): EmittedPattern {
  let value = w.patterns.get(name.text);
  if (value == null) {
    throw new SourceError(
      name,
      `undefined pattern ${JSON.stringify(name.text)}`,
    );
  }
  switch (value.kind) {
    case Kind.Pattern:
      return writePattern(w, value);
    case Kind.EmittedPattern:
      return value;
    default:
      const dummy: never = value;
      throw new AssertionError('invalid pattern kind');
  }
}

function writeNotes(w: ScoreWriter, item: Notes): void {
  const { patternName, notes } = item;
  const pattern = getPattern(w, patternName);
  if (pattern.size != notes.length) {
    throw new SourceError(
      item.loc,
      `pattern requires ${pattern.size} notes, ` +
        `but ${notes.length} notes are provided`,
    );
  }
  w.output.write(Opcode.Notes + pattern.index);
  for (const note of notes) {
    w.output.write(note.value);
  }
}

function writeItem(w: ScoreWriter, item: Item): void {
  switch (item.kind) {
    case Kind.Pattern:
      addPattern(w, item);
      break;
    case Kind.Notes:
      writeNotes(w, item);
      break;
    default:
      const dummy: never = item;
      throw new AssertionError('unknown item kind');
  }
}

// =============================================================================
// Entry point
// =============================================================================

/** A reference to a sound. */
interface SoundReference {
  /** The name of the sound file, without extension. */
  name: string;
  /** Locations where the reference appears in the score. */
  locs: HasSourceLoc[];
}

/** A parsed musical score. */
interface Score {
  /**
   * List of sounds used by this score.
   */
  sounds: readonly SoundReference[];

  /**
   * Emit the score as program code.
   * @param sounds Map from sound names to sound asset indexes.
   */
  emit(sounds: ReadonlyMap<string, number>): Uint8Array;
}

/** Parse a musical score. */
export function parseScore(source: string): Score {
  const items = parseScoreItems(source);
  const sounds: SoundReference[] = [{ name: 'bass', locs: [] }];
  return {
    sounds,
    emit(sounds: ReadonlyMap<string, number>): Uint8Array {
      const output = new DataWriter();
      const w: ScoreWriter = {
        output,
        patterns: new Map<string, Pattern | EmittedPattern>(),
        nextPatternIndex: 0,
      };
      for (const item of items) {
        writeItem(w, item);
      }
      return output.getData();
    },
  };
}
