import { AssertionError } from '../debug/debug';

interface Event {
  time: number;
  data: Uint8Array;
}

function checkData(name: string, value: number): void {
  if (value < 0 || 128 <= value) {
    throw new AssertionError(`${name} out of range`, { value });
  }
  if ((value | 0) != value) {
    throw new AssertionError(`fractional ${name}`, { value });
  }
}

function checkChannel(channel: number): void {
  if (channel < 0 || 16 <= channel) {
    throw new AssertionError('channel out of range', { channel });
  }
  if ((channel | 0) != channel) {
    throw new AssertionError('fractional channel', { channel });
  }
}

/** Encode ASCII text as data. */
function encode(out: Uint8Array, text: string, offset: number): void {
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i);
    if (value < 0 || 128 <= value) {
      throw new AssertionError('cannot encode text', { text, i, value });
    }
    out[offset + i] = value;
  }
}

/** Class for creating a MIDI track. */
export class MIDITrackWriter {
  private readonly events: Event[] = [];
  getData(): Uint8Array {
    interface SortEvent {
      time: number;
      index: number;
      data: Uint8Array;
    }
    const sortEvents: SortEvent[] = this.events.map(
      ({ time, data }, index) => ({ time, index, data }),
    );
    sortEvents.sort((x, y) => {
      if (x.time != y.time) {
        return x.time - y.time;
      } else {
        return x.index - y.index;
      }
    });
    let maxSize = 0;
    for (const event of sortEvents) {
      maxSize += 4 + event.data.length;
    }
    const output = new Uint8Array(maxSize);
    let pos = 0;
    let currentTime = 0;
    for (const { time, data } of sortEvents) {
      let delta = time - currentTime;
      currentTime = time;
      let ipos = 4;
      while (ipos > 1 && delta >> (ipos * 7) == 0) {
        ipos--;
      }
      for (; ipos >= 0; ipos--) {
        output[pos++] = ((delta >> (ipos * 7)) & 0x7f) | (ipos == 0 ? 0 : 0x80);
      }
      output.set(data, pos);
      pos += data.length;
    }
    return output.subarray(0, pos);
  }
  noteOff(
    time: number,
    key: number,
    velocity: number = 100,
    channel: number = 0,
  ): void {
    checkChannel(channel);
    checkData('key', key);
    checkData('velocity', velocity);
    this.events.push({
      time,
      data: Uint8Array.of(0x80 | channel, key, velocity),
    });
  }
  noteOn(
    time: number,
    key: number,
    velocity: number = 100,
    channel: number = 0,
  ): void {
    checkChannel(channel);
    checkData('key', key);
    checkData('velocity', velocity);
    this.events.push({
      time,
      data: Uint8Array.of(0x90 | channel, key, velocity),
    });
  }
  setTempo(time: number, tempo: number): void {
    this.events.push({
      time,
      data: Uint8Array.of(0xff, 0x51, 0x03, tempo >> 16, tempo >> 8, tempo),
    });
  }
  private writeText(time: number, code: number, text: string): void {
    const data = new Uint8Array(text.length + 3);
    data[0] = 0xff;
    data[1] = code;
    data[2] = text.length;
    encode(data, text, 3);
    this.events.push({ time, data });
  }
  trackName(time: number, name: string): void {
    this.writeText(time, 0x03, name);
  }
  endTrack(time: number): void {
    this.events.push({ time, data: Uint8Array.of(0xff, 0x2f, 0x00) });
  }
}

/** The contents of a MIDI file. */
export interface MIDIFile {
  /**
   * Format 0: A single track.
   * Format 1: Simultaneous tracks.
   * Format 2: Independent tracks.
   */
  format: number;
  /** The contents of the MIDI file. */
  tracks: Uint8Array[];
  /** Number of ticks per quarter note. */
  ticksPerQuarterNote: number;
}

/** Encode a MIDI file and return the raw data. */
export function encodeMIDI(contents: MIDIFile): Uint8Array {
  interface Chunk {
    type: string;
    data: Uint8Array;
  }
  const chunks: Chunk[] = [];
  (function writeHeader(): void {
    const data = new Uint8Array(6);
    const v = new DataView(data.buffer);
    v.setUint16(0, contents.format);
    v.setUint16(2, contents.tracks.length);
    v.setUint16(4, contents.ticksPerQuarterNote);
    chunks.push({ type: 'MThd', data });
  })();
  for (const track of contents.tracks) {
    chunks.push({ type: 'MTrk', data: track });
  }
  let size = 0;
  for (const { data } of chunks) {
    size += 8 + data.length;
  }
  const output = new Uint8Array(size);
  const view = new DataView(output.buffer);
  let pos = 0;
  for (const { type, data } of chunks) {
    encode(output, type, pos);
    view.setUint32(pos + 4, data.length);
    output.set(data, pos + 8);
    pos += 8 + data.length;
  }
  return output;
}
