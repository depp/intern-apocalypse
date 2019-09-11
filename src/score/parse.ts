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
  Values,
  Emit,
  HardTranspose,
  SoftTranspose,
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

/** Sequence of notes. */
interface Values extends ItemBase {
  kind: Kind.Values;
  name: Chunk;
  values: NoteValue[];
}

/** Emit notes. */
interface Emit extends ItemBase {
  kind: Kind.Emit;
  items: Chunk[];
}

/** Transposition command. */
interface Transpose extends ItemBase {
  kind: Kind.HardTranspose | Kind.SoftTranspose;
  amount: number;
}

/** Tempo command. */
interface Tempo extends ItemBase {
  kind: Kind.Tempo;
  tempo: number;
}

/** An item in a parsed score. */
type Item = Track | Pattern | Values | Emit | Transpose | Tempo;

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

deftype('values', function parseNotes(loc, fields): Values {
  if (fields.length < 1) {
    throw new SourceError(
      loc,
      `values requires at least 1 field, got ${fields.length}`,
    );
  }
  const values: NoteValue[] = [];
  for (let i = 1; i < fields.length; i++) {
    values.push(parseNoteValue(fields[i]));
  }
  return {
    kind: Kind.Values,
    loc,
    name: fields[0],
    values,
  };
});

deftype('emit', function parseEmit(loc, fields): Emit {
  return { kind: Kind.Emit, loc, items: fields };
});

deftype('transpose', function parseTranspose(loc, fields): Transpose {
  if (fields.length != 2) {
    throw new SourceError(
      loc,
      `transpose requires 2 fields, got ${fields.length}`,
    );
  }
  let kind = Kind.HardTranspose | Kind.SoftTranspose;
  switch (fields[0].text.toLowerCase()) {
    case 'hard':
      kind = Kind.HardTranspose;
      break;
    case 'soft':
      kind = Kind.SoftTranspose;
      break;
    default:
      throw new SourceError(fields[0], 'unknown transposition type');
  }
  const amount = parseIntExact(fields[1]);
  return { kind, loc, amount };
});

deftype('tempo', function parseTempo(loc, fields): Tempo {
  if (fields.length != 1) {
    throw new SourceError(loc, `tempo requires 1 field, got ${fields.length}`);
  }
  const tempo = parseIntExact(fields[0]);
  return { kind: Kind.Tempo, loc, tempo };
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

/** Test if two buffers contain the same data. */
function equalData(x: Uint8Array, y: Uint8Array): boolean {
  if (x.length != y.length) {
    return false;
  }
  for (let i = 0; i < x.length; i++) {
    if (x[i] != y[i]) {
      return false;
    }
  }
  return true;
}

function duplicateName(name: Chunk): SourceError {
  return new SourceError(name, `duplicate name: ${JSON.stringify(name.text)}`);
}

interface DataChunk {
  kind: Kind.Pattern | Kind.Values;
  data: Uint8Array;
  size: number;
}

/** The state of a score being written. */
interface ScoreWriter {
  sounds: ReadonlyMap<string, number>;
  data: DataWriter;
  commands: DataWriter;
  trackName: string | null;
  trackNames: string[];
  emittedChunks: Uint8Array[];
  namedChunks: Map<string, DataChunk>;
  transposeGlobal: number;
  transposeLocal: number;
  hasTempo: boolean;
}

function setChunk(w: ScoreWriter, name: Chunk, value: DataChunk): void {
  let key = '.' + name.text;
  const { namedChunks, trackName } = w;
  if (namedChunks.has(key)) {
    throw duplicateName(name);
  }
  if (trackName != null) {
    key = trackName + key;
    if (namedChunks.has(key)) {
      throw duplicateName(name);
    }
  }
  namedChunks.set(key, value);
}

interface DataChunkResult {
  kind: Kind.Pattern | Kind.Values;
  size: number;
  index: number;
}

function getChunk(w: ScoreWriter, name: Chunk): DataChunkResult {
  const { emittedChunks, namedChunks, trackName } = w;
  let key = '.' + name.text;
  let value = namedChunks.get(key);
  if (value == null) {
    if (trackName != null) {
      key = trackName + key;
      value = namedChunks.get(key);
    }
  }
  if (value == null) {
    throw new SourceError(name, `undefined: ${JSON.stringify(name.text)}`);
  }
  const { kind, data, size } = value;
  let index: number | undefined;
  for (let i = 0; i < emittedChunks.length; i++) {
    if (equalData(emittedChunks[i], data)) {
      index = i;
      break;
    }
  }
  if (index == null) {
    if (data.length == 0) {
      throw new AssertionError('empty data', { name: name.text });
    }
    w.data.write(data.length);
    w.data.writeArray(data);
    index = emittedChunks.length;
    emittedChunks.push(data);
  }
  // console.log(`Name: {name.text}, index: ${index}`)
  return { kind, size, index };
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
  w.commands.write(Opcode.Track, index, soundIndex);
  w.trackName = name.text;
  w.transposeLocal = w.transposeGlobal;
}

function writeNoteRhythm(dw: DataWriter, note: NoteRhythm): void {
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
  dw.write(value);
}

function writePattern(w: ScoreWriter, item: Pattern): void {
  const dw = new DataWriter();
  const { kind, name, notes } = item;
  let size = 0;
  for (const note of notes) {
    if (note.noteIndex) {
      size = Math.max(size, note.noteIndex);
    }
    writeNoteRhythm(dw, note);
  }
  setChunk(w, name, { kind, data: dw.getData(), size });
}

function writeValues(w: ScoreWriter, item: Values): void {
  const { transposeLocal } = w;
  const { kind, name, values } = item;
  const dw = new DataWriter();
  for (const value of values) {
    dw.write(value.value + transposeLocal);
  }
  setChunk(w, name, { kind, data: dw.getData(), size: values.length });
}

function writeEmit(w: ScoreWriter, item: Emit): void {
  if (!w.hasTempo) {
    throw new SourceError(item.loc, 'tempo directive required');
  }
  if (w.trackName == null) {
    throw new SourceError(item.loc, 'notes must appear inside track');
  }
  const { items } = item;
  const enum State {
    None,
    Pattern,
    Values,
  }
  let state = State.None;
  let pattern: number | undefined;
  let patternItem: Chunk | undefined;
  for (const it of items) {
    const { kind, index } = getChunk(w, it);
    switch (kind) {
      case Kind.Pattern:
        if (state == State.Pattern) {
          if (patternItem == null) {
            throw new AssertionError('invalid state');
          }
          throw new SourceError(patternItem, 'pattern has no values');
        }
        state = State.Pattern;
        pattern = index;
        patternItem = it;
        break;
      case Kind.Values:
        if (pattern == null) {
          throw new SourceError(it, 'need pattern before values');
        }
        state = State.Values;
        w.commands.write(Opcode.Notes + pattern, index);
        break;
      default:
        const dummy: any = kind;
        throw new AssertionError('unknown kind');
    }
  }
  switch (state) {
    case State.None:
      throw new SourceError(item.loc, 'empty emit directive');
    case State.Pattern:
      if (patternItem == null) {
        throw new AssertionError('invalid state');
      }
      throw new SourceError(patternItem, 'pattern has no values');
  }
}

function writeHardTranspose(w: ScoreWriter, item: Transpose): void {
  if (w.trackName == null) {
    w.transposeGlobal = item.amount;
  } else {
    w.transposeLocal = w.transposeGlobal + item.amount;
  }
}

function writeSoftTranspose(w: ScoreWriter, item: Transpose): void {
  if (w.trackName == null) {
    throw new SourceError(item.loc, 'soft transpose requires track');
  }
  throw new Error('unimplemented');
}

function writeTempo(w: ScoreWriter, item: Tempo): void {
  const value = Math.round((item.tempo - 50) / 2);
  w.commands.write(Opcode.Tempo, value);
  w.hasTempo = true;
}

function writeItem(w: ScoreWriter, item: Item): void {
  switch (item.kind) {
    case Kind.Track:
      writeTrack(w, item);
      break;
    case Kind.Pattern:
      writePattern(w, item);
      break;
    case Kind.Values:
      writeValues(w, item);
      break;
    case Kind.Emit:
      writeEmit(w, item);
      break;
    case Kind.HardTranspose:
      writeHardTranspose(w, item);
      break;
    case Kind.SoftTranspose:
      writeSoftTranspose(w, item);
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
      const data = new DataWriter();
      const commands = new DataWriter();
      const w: ScoreWriter = {
        sounds,
        data,
        commands,
        trackName: null,
        trackNames: [],
        emittedChunks: [],
        namedChunks: new Map<string, DataChunk>(),
        transposeGlobal: 0,
        transposeLocal: 0,
        hasTempo: false,
      };
      for (const item of items) {
        writeItem(w, item);
      }
      const b1 = data.getData();
      const b2 = commands.getData();
      const result = new Uint8Array(b1.length + b2.length + 1);
      result.set(b1);
      result.set(b2, b1.length + 1);
      return result;
    },
  };
}
