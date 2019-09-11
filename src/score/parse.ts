import { AssertionError } from '../debug/debug';
import {
  Chunk,
  splitLines,
  splitFields,
  chunkEnd,
  parseIntExact,
} from '../lib/textdata';
import { SourceError, SourceSpan, HasSourceLoc } from '../lib/sourcepos';
import { DataWriter } from '../lib/data.writer';
import { Opcode } from './opcode';
import { dataMax } from '../lib/data.encode';

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
  Track,
  Pattern,
  EmittedPattern,
  Notes,
  Transpose,
  Tempo,
}

/** Base type for items in a parsed score. */
interface ItemBase {
  kind: Kind;
  loc: SourceSpan;
}

/** Start of track in score. */
interface Track extends ItemBase {
  kind: Kind.Track;
  name: Chunk;
  instrument: Chunk;
}

/** Rhythmic pattern for notes. */
interface Pattern extends ItemBase {
  kind: Kind.Pattern;
  name: Chunk;
  notes: NoteRhythm[];
}

/** Reference to a rythmic patter which has been written out. */
interface EmittedPattern {
  kind: Kind.EmittedPattern;
  index: number;
  /** Number of note values required. */
  size: number;
}

/** Sequence of notes. */
interface Notes extends ItemBase {
  kind: Kind.Notes;
  patternName: Chunk;
  notes: NoteValue[];
}

/** Transposition command. */
interface Transpose extends ItemBase {
  kind: Kind.Transpose;
  amount: number;
}

/** Tempo command. */
interface Tempo extends ItemBase {
  kind: Kind.Tempo;
  tempo: number;
}

/** An item in a parsed score. */
type Item = Track | Pattern | Notes | Transpose | Tempo;

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

/** Parse an new track directive. */
deftype('track', function parseTrack(loc, fields): Track {
  if (fields.length != 2) {
    throw new SourceError(loc, `track requires 2 fields, got ${fields.length}`);
  }
  const [name, instrument] = fields;
  return {
    kind: Kind.Track,
    loc,
    name,
    instrument,
  };
});

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

deftype('transpose', function parseTranspose(loc, fields): Transpose {
  if (fields.length != 1) {
    throw new SourceError(
      loc,
      `transpose requires 1 field, got ${fields.length}`,
    );
  }
  const amount = parseIntExact(fields[0]);
  return {
    kind: Kind.Transpose,
    loc,
    amount,
  };
});

deftype('tempo', function parseTempo(loc, fields): Tempo {
  if (fields.length != 1) {
    throw new SourceError(loc, `tempo requires 1 field, got ${fields.length}`);
  }
  const tempo = parseIntExact(fields[0]);
  return {
    kind: Kind.Tempo,
    loc,
    tempo,
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
  sounds: ReadonlyMap<string, number>;
  output: DataWriter;
  trackName: string | null;
  trackNames: string[];
  patterns: Map<string, Pattern | EmittedPattern>;
  nextPatternIndex: number;
  trackTranspose: number;
  globalTranspose: number;
  hasTempo: boolean;
}

function writeTrack(w: ScoreWriter, item: Track): void {
  const { name, instrument } = item;
  let index = w.trackNames.indexOf(name.text);
  if (index == -1) {
    index = w.trackNames.length;
    w.trackNames.push(name.text);
  }
  const soundIndex = w.sounds.get(instrument.text);
  if (soundIndex == null) {
    // Caller forgot to supply this instrument.
    throw new AssertionError(`undefined instrument`, { name: instrument.text });
  }
  w.output.write(Opcode.Track, index, soundIndex);
  w.trackName = name.text;
  w.trackTranspose = w.globalTranspose;
}

function duplicatePattern(name: Chunk): SourceError {
  return new SourceError(
    name,
    `duplicate pattern name: ${JSON.stringify(name.text)}`,
  );
}

function addPattern(w: ScoreWriter, item: Pattern): void {
  const { name } = item;
  let key = '.' + name.text;
  if (w.trackName) {
    if (w.patterns.has(key)) {
      throw duplicatePattern(name);
    }
    key = w.trackName + key;
  }
  if (w.patterns.has(key)) {
    throw duplicatePattern(name);
  }
  w.patterns.set(key, item);
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

function writePattern(
  w: ScoreWriter,
  item: Pattern,
  key: string,
): EmittedPattern {
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
  w.patterns.set(key, value);
  return value;
}

function getPattern(w: ScoreWriter, name: Chunk): EmittedPattern {
  if (w.trackName == null) {
    throw new AssertionError('trackName == null');
  }
  let key;
  let value: Pattern | EmittedPattern | null | undefined;
  for (const prefix of [w.trackName, '']) {
    const candidate = prefix + '.' + name.text;
    value = w.patterns.get(candidate);
    if (value != null) {
      key = candidate;
      break;
    }
  }
  if (value == null) {
    throw new SourceError(
      name,
      `undefined pattern ${JSON.stringify(name.text)}`,
    );
  }
  switch (value.kind) {
    case Kind.Pattern:
      if (key == null) {
        throw new AssertionError('key == null');
      }
      return writePattern(w, value, key);
    case Kind.EmittedPattern:
      return value;
    default:
      const dummy: never = value;
      throw new AssertionError('invalid pattern kind');
  }
}

function writeNotes(w: ScoreWriter, item: Notes): void {
  if (!w.hasTempo) {
    throw new SourceError(item.loc, 'tempo directive required');
  }
  if (w.trackName == null) {
    throw new SourceError(item.loc, 'notes must appear inside track');
  }
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
    const value = note.value + w.trackTranspose;
    if (value < 0 || dataMax < value) {
      throw new SourceError(note, `note value out of range: ${value}`);
    }
    w.output.write(value);
  }
}

function writeTempo(w: ScoreWriter, item: Tempo): void {
  const value = Math.round((item.tempo - 50) / 2);
  w.output.write(Opcode.Tempo, value);
  w.hasTempo = true;
}

function writeItem(w: ScoreWriter, item: Item): void {
  switch (item.kind) {
    case Kind.Track:
      writeTrack(w, item);
      break;
    case Kind.Pattern:
      addPattern(w, item);
      break;
    case Kind.Notes:
      writeNotes(w, item);
      break;
    case Kind.Transpose:
      if (w.trackName == null) {
        w.globalTranspose = item.amount;
      } else {
        w.trackTranspose = w.globalTranspose + item.amount;
      }
      break;
    case Kind.Tempo:
      writeTempo(w, item);
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
  const sounds: SoundReference[] = [];
  for (const item of items) {
    if (item.kind == Kind.Track) {
      const { instrument } = item;
      let ref: SoundReference | undefined;
      for (const sound of sounds) {
        if (sound.name == instrument.text) {
          ref = sound;
          break;
        }
      }
      if (!ref) {
        ref = { name: instrument.text, locs: [] };
        sounds.push(ref);
      }
      ref.locs.push(instrument);
    }
  }
  return {
    sounds,
    emit(sounds: ReadonlyMap<string, number>): Uint8Array {
      const output = new DataWriter();
      const w: ScoreWriter = {
        sounds,
        output,
        trackName: null,
        trackNames: [],
        patterns: new Map<string, Pattern | EmittedPattern>(),
        nextPatternIndex: 0,
        globalTranspose: 0,
        trackTranspose: 0,
        hasTempo: false,
      };
      for (const item of items) {
        writeItem(w, item);
      }
      return output.getData();
    },
  };
}
