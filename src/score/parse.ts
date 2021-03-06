import { AssertionError } from '../debug/debug';
import {
  Chunk,
  splitLines,
  splitFields,
  chunkEnd,
  parseIntExact,
  parseFloatExact,
} from '../lib/textdata';
import { SourceError, SourceSpan, HasSourceLoc } from '../lib/sourcepos';
import { DataWriter } from '../lib/data.writer';
import { Opcode, signedOffset, noteRewind } from './opcode';
import { toDataClamp, encodeExponential } from '../lib/data.encode';
import { MIDITrackWriter, encodeMIDI } from './midi';

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

/** The lengths of duration modifiers. */
const durationModifiers: readonly number[] = [6, 9, 4];

/** Types of elements that can appear in a rhythm. */
export enum RhythmKind {
  /** Play a note. */
  Note,
  /** Rewind to the beginning of the pattern. */
  Rewind,
}

export interface RhythmBase extends SourceSpan {
  kind: RhythmKind;
}

/** The rhythm part of a note. */
export interface NoteRhythm extends RhythmBase {
  kind: RhythmKind.Note;

  /**
   * Base value, exponential. 0 = whole note, 1 = half note, 2 = quarter, etc.
   */
  baseDuration: number;

  /** Modifier to the base duration value. */
  durationModifier: DurationModifier;

  /** Note to play, or null for rest. */
  noteIndex: number | null;
}

/** A rhythm directive which is not a note. */
export interface RhythmSpecial extends SourceSpan {
  kind: RhythmKind.Rewind;
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
    kind: RhythmKind.Note,
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
  Skip,
  Emit,
  HardTranspose,
  SoftTranspose,
  Tempo,
  Inversion,
  Reverse,
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
  level: number;
}

/** An item in a rhythm pattern. */
type RhythmItem = NoteRhythm | RhythmSpecial;

/** Rhythmic pattern for notes. */
interface Pattern extends ItemBase {
  kind: Kind.Pattern;
  name: Chunk;
  notes: RhythmItem[];
}

/** Sequence of notes. */
interface Values extends ItemBase {
  kind: Kind.Values;
  name: Chunk;
  values: NoteValue[];
}

/** Skip measures. */
interface Skip extends ItemBase {
  kind: Kind.Skip;
  count: number;
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

/** Note value inversion setting. */
interface Inversion extends ItemBase {
  kind: Kind.Inversion;
  amount: number;
}

/** Note value time reversal setting. */
interface Reverse extends ItemBase {
  kind: Kind.Reverse;
  enabled: boolean;
}

/** An item in a parsed score. */
type Item =
  | Track
  | Pattern
  | Values
  | Skip
  | Emit
  | Transpose
  | Tempo
  | Inversion
  | Reverse;

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
  if (fields.length != 3) {
    throw new SourceError(loc, `track requires 3 fields, got ${fields.length}`);
  }
  const [name, instrument, level] = fields;
  return {
    kind: Kind.Track,
    loc,
    name,
    instrument,
    level: 10 ** (parseFloatExact(level) / 20),
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
  const notes: RhythmItem[] = [];
  for (let i = 1; i < fields.length; i++) {
    const item = fields[i];
    let kind: RhythmSpecial['kind'] | null = null;
    switch (item.text) {
      case '/':
        kind = RhythmKind.Rewind;
        break;
    }
    if (kind == null) {
      notes.push(parseRhythm(item));
    } else {
      notes.push({
        kind,
        sourceStart: item.sourcePos,
        sourceEnd: chunkEnd(item),
      });
    }
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

deftype('skip', function parseSkip(loc, fields): Skip {
  if (fields.length != 1) {
    throw new SourceError(loc, `skip requires 1 field, got ${fields.length}`);
  }
  const count = parseIntExact(fields[0]);
  return {
    kind: Kind.Skip,
    loc,
    count,
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

deftype('inversion', function parseInversion(loc, fields): Inversion {
  if (fields.length != 1) {
    throw new SourceError(
      loc,
      `inversion requires 1 field, got ${fields.length}`,
    );
  }
  const amount = parseIntExact(fields[0]);
  return { kind: Kind.Inversion, loc, amount };
});

for (const direction of ['forward', 'reverse']) {
  deftype(direction, function parseInversion(loc, fields): Reverse {
    if (fields.length != 0) {
      throw new SourceError(
        loc,
        `${direction} requires 0 fields, got ${fields.length}`,
      );
    }
    return { kind: Kind.Reverse, loc, enabled: direction == 'reverse' };
  });
}

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
  softTranspose: number;
  inversion: number;
  reverse: boolean;
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
  const { name, instrument, level } = item;
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
  w.commands.write(
    Opcode.Track,
    soundIndex,
    toDataClamp(encodeExponential(level)),
  );
  w.trackName = name.text;
  w.transposeLocal = w.transposeGlobal;
  w.softTranspose = 0;
  w.inversion = 0;
  w.reverse = false;
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
    switch (note.kind) {
      case RhythmKind.Note:
        if (note.noteIndex) {
          size = Math.max(size, note.noteIndex);
        }
        writeNoteRhythm(dw, note);
        break;
      case RhythmKind.Rewind:
        dw.write(noteRewind);
        break;
      default:
        const dummy: never = note;
        throw new AssertionError('unknown rhythm kind');
    }
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

function requireTrack(w: ScoreWriter, item: ItemBase): void {
  if (w.trackName == null) {
    throw new SourceError(item.loc, 'track required');
  }
}

function writeSkip(w: ScoreWriter, item: Skip): void {
  requireTrack(w, item);
  w.commands.write(Opcode.Skip, item.count);
}

function writeEmit(w: ScoreWriter, item: Emit): void {
  if (!w.hasTempo) {
    throw new SourceError(item.loc, 'tempo directive required');
  }
  requireTrack(w, item);
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
  requireTrack(w, item);
  const { amount } = item;
  if (w.softTranspose != amount) {
    w.softTranspose = amount;
    w.commands.write(Opcode.Transpose, amount + signedOffset);
  }
}

function writeTempo(w: ScoreWriter, item: Tempo): void {
  const value = Math.round((item.tempo - 50) / 2);
  w.commands.write(Opcode.Tempo, value);
  w.hasTempo = true;
}

function writeInversion(w: ScoreWriter, item: Inversion): void {
  requireTrack(w, item);
  const { amount } = item;
  if (w.inversion != amount) {
    w.inversion = amount;
    w.commands.write(Opcode.Inversion, amount);
  }
}

function writeReverse(w: ScoreWriter, item: Reverse): void {
  requireTrack(w, item);
  const { enabled } = item;
  if (w.reverse != enabled) {
    w.reverse = enabled;
    w.commands.write(Opcode.Reverse);
  }
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
    case Kind.Skip:
      writeSkip(w, item);
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
    case Kind.Inversion:
      writeInversion(w, item);
      break;
    case Kind.Reverse:
      writeReverse(w, item);
      break;
    default:
      const dummy: never = item;
      throw new AssertionError('unknown item kind');
  }
}

// =============================================================================
// MIDI output
// =============================================================================

interface MIDITrack {
  names: Map<string, Pattern | Values>;
  output: MIDITrackWriter;
  hardTranspose: number;
  duration: number;
  inversion: number;
  reverse: boolean;
}

interface MIDIState {
  names: Map<string, Pattern | Values>;
  tracks: Map<string, MIDITrack>;
  track: MIDITrack | null;
  globalTrack: MIDITrackWriter;
  time: number;
  hardTranspose: number;
  softTranspose: number;
}

/** Convert Values to MIDI note values. */
function convertValues(
  state: MIDIState,
  track: MIDITrack,
  values: Values,
): Int32Array {
  const result = new Int32Array(values.values.length);
  for (let i = 0; i < values.values.length; i++) {
    result[i] =
      values.values[i].value +
      track.hardTranspose +
      state.softTranspose +
      60 -
      middleC;
  }
  const chromaticity = result.map(x => x % 12);
  for (let i = 0; i < track.inversion; i++) {
    let newValue = result[result.length - 1];
    for (let j = 1; j < 13; j++) {
      if (chromaticity.includes((newValue + j) % 12)) {
        newValue += j;
        break;
      }
    }
    result.copyWithin(0, 1);
    result[result.length - 1] = newValue;
  }
  if (track.reverse) {
    result.reverse();
  }
  return result;
}

function emitMIDINoteSegment(
  state: MIDIState,
  track: MIDITrack,
  pattern: Pattern,
  values: Values,
): void {
  const notes = convertValues(state, track, values);
  const startTime = state.time;
  for (const rh of pattern.notes) {
    switch (rh.kind) {
      case RhythmKind.Rewind:
        state.time = startTime;
        break;
      case RhythmKind.Note:
        {
          const { noteIndex, baseDuration, durationModifier } = rh;
          let duration = durationModifiers[durationModifier];
          if (!duration) {
            throw new AssertionError('invalid duration modifier');
          }
          duration <<= 4 - baseDuration;
          const time = state.time;
          if (
            noteIndex != null &&
            0 < noteIndex &&
            noteIndex <= values.values.length
          ) {
            const note = notes[noteIndex - 1];
            track.output.noteOn(time, note);
            track.output.noteOff(time + duration, note);
          }
          state.time = time + duration;
          track.duration = Math.max(track.duration, state.time);
        }
        break;
      default:
        const dummy: never = rh;
        throw new AssertionError('invalid kind');
    }
  }
}

function emitMIDINotes(state: MIDIState, emit: Emit): void {
  const { track } = state;
  if (!track) {
    throw new SourceError(emit.loc, 'needs track');
  }
  let pattern: Pattern | null = null;
  for (const item of emit.items) {
    const obj = track.names.get(item.text) || state.names.get(item.text);
    if (obj == null) {
      throw new SourceError(item, 'no such object');
    }
    switch (obj.kind) {
      case Kind.Pattern:
        pattern = obj;
        break;
      case Kind.Values:
        if (pattern == null) {
          throw new SourceError(item, 'needs pattern');
        }
        emitMIDINoteSegment(state, track, pattern, obj);
        break;
      default:
        const dummy: never = obj;
        throw new AssertionError('bad kind');
    }
  }
}

function emitMIDIItem(state: MIDIState, item: Item): void {
  switch (item.kind) {
    case Kind.Track:
      {
        const name = item.name.text;
        let track = state.tracks.get(name);
        if (track == null) {
          const output = new MIDITrackWriter();
          output.trackName(0, name);
          track = {
            names: new Map<string, Pattern | Values>(),
            output,
            hardTranspose: 0,
            duration: 0,
            inversion: 0,
            reverse: false,
          };
          state.tracks.set(name, track);
        }
        track.hardTranspose = state.hardTranspose;
        track.inversion = 0;
        track.reverse = false;
        state.track = track;
        state.time = 0;
      }
      break;
    case Kind.Pattern:
      {
        const names = state.track ? state.track.names : state.names;
        names.set(item.name.text, item);
      }
      break;
    case Kind.Values:
      {
        const names = state.track ? state.track.names : state.names;
        names.set(item.name.text, item);
      }
      break;
    case Kind.Skip:
      {
        const { track } = state;
        if (!track) {
          throw new SourceError(item.loc, 'track required');
        }
        state.time += item.count * 6 * 16;
        track.duration = Math.max(track.duration, state.time);
      }
      break;
    case Kind.Emit:
      emitMIDINotes(state, item);
      break;
    case Kind.HardTranspose:
      {
        const { track } = state;
        if (track) {
          track.hardTranspose = state.hardTranspose + item.amount;
        } else {
          state.hardTranspose = item.amount;
        }
      }
      break;
    case Kind.SoftTranspose:
      state.softTranspose = item.amount;
      break;
    case Kind.Tempo:
      {
        const usecPerQuarterNote = Math.round((60 * 1e6) / item.tempo);
        state.globalTrack.setTempo(0, usecPerQuarterNote);
      }
      break;
    case Kind.Inversion:
      {
        const { track } = state;
        if (!track) {
          throw new SourceError(item.loc, 'requires track');
        }
        track.inversion = item.amount;
      }
      break;
    case Kind.Reverse:
      {
        const { track } = state;
        if (!track) {
          throw new SourceError(item.loc, 'requires track');
        }
        track.reverse = item.enabled;
      }
      break;
    default:
      const dummy: never = item;
      throw new AssertionError('unknown item kind');
  }
}

function emitMIDI(items: Item[]): Uint8Array {
  const state: MIDIState = {
    names: new Map<string, Pattern | Values>(),
    tracks: new Map<string, MIDITrack>(),
    track: null,
    globalTrack: new MIDITrackWriter(),
    time: 0,
    hardTranspose: 0,
    softTranspose: 0,
  };
  for (const item of items) {
    emitMIDIItem(state, item);
  }
  const tracks: Uint8Array[] = [];
  let globalDuration = 0;
  for (const { duration } of state.tracks.values()) {
    globalDuration = Math.max(globalDuration, duration);
  }
  state.globalTrack.endTrack(globalDuration);
  tracks.push(state.globalTrack.getData());
  for (const { output, duration } of state.tracks.values()) {
    output.endTrack(duration);
    tracks.push(output.getData());
  }
  return encodeMIDI({
    format: 1,
    tracks,
    ticksPerQuarterNote: 24,
  });
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
export interface Score {
  /**
   * List of sounds used by this score.
   */
  sounds: readonly SoundReference[];

  /** List of track names. */
  tracks: readonly string[];

  /**
   * Emit the score as program code.
   * @param sounds Map from sound names to sound asset indexes.
   * @param tracks If specified, only render these tracks.
   */
  emit(
    sounds: ReadonlyMap<string, number>,
    tracks?: readonly string[] | null,
  ): Uint8Array;

  /** Emit the score a MIDI file. */
  emitMIDI(): Uint8Array;
}

/** Parse a musical score. */
export function parseScore(source: string): Score {
  const items = parseScoreItems(source);
  const sounds: SoundReference[] = [];
  const tracks: string[] = [];
  for (const item of items) {
    if (item.kind == Kind.Track) {
      const { name, instrument } = item;
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
      if (!tracks.includes(name.text)) {
        tracks.push(name.text);
      }
    }
  }
  const zeroChunk = new Uint8Array();
  return {
    sounds,
    tracks,
    emit(
      sounds: ReadonlyMap<string, number>,
      tracks: string[] | null = null,
    ): Uint8Array {
      const data = new DataWriter();
      const commands = new DataWriter();
      const w: ScoreWriter = {
        sounds,
        data,
        commands,
        trackName: null,
        trackNames: [],
        emittedChunks: [zeroChunk],
        namedChunks: new Map<string, DataChunk>([
          ['.-', { kind: Kind.Values, data: zeroChunk, size: 0 }],
        ]),
        transposeGlobal: 0,
        transposeLocal: 0,
        hasTempo: false,
        softTranspose: 0,
        inversion: 0,
        reverse: false,
      };
      for (const item of items) {
        if (
          item.kind != Kind.Track &&
          tracks != null &&
          w.trackName != null &&
          !tracks.includes(w.trackName)
        ) {
          continue;
        }
        writeItem(w, item);
      }
      const b1 = data.getData();
      const b2 = commands.getData();
      const result = new Uint8Array(b1.length + b2.length + 1);
      result.set(b1);
      result.set(b2, b1.length + 1);
      return result;
    },
    emitMIDI(): Uint8Array {
      return emitMIDI(items);
    },
  };
}
