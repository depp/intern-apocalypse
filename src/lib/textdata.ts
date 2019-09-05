/**
 * Text format data parser.
 */

import { AssertionError } from '../debug/debug';
import { SourceError } from './sourcepos';

/** A chunk of text in a source file. */
export interface Chunk {
  text: string;
  sourcePos: number;
}

/** Return the endo position of a chunk. */
export function chunkEnd(chunk: Chunk): number {
  return chunk.sourcePos + chunk.text.length;
}

/** Split a source file into lines. */
export function splitLines(source: string): Chunk[] {
  const linebreak = /\r?\n/g;
  let match: RegExpMatchArray | null;
  let pos = 0;
  const result: Chunk[] = [];
  while ((match = linebreak.exec(source)) != null) {
    result.push({ text: source.substring(pos, match.index), sourcePos: pos });
    pos = linebreak.lastIndex;
  }
  if (pos != source.length) {
    result.push({
      text: source.substring(pos),
      sourcePos: pos,
    });
  }
  return result;
}

/** Split a line into individual fields. */
export function splitFields(line: Chunk): Chunk[] {
  let { text, sourcePos } = line;
  const space = /[ \t]*/;
  let match = space.exec(text);
  if (match == null) {
    throw new AssertionError('null match');
  }
  const spacelen = match[0].length;
  text = text.substring(spacelen);
  sourcePos += spacelen;
  const result: Chunk[] = [];
  const field = /([!-~]+)[ \t]*/y;
  let pos = 0;
  while ((match = field.exec(text)) != null) {
    const data = match[1];
    if (data.startsWith('#')) {
      return result;
    }
    result.push({ text: data, sourcePos: sourcePos + match.index });
    pos = field.lastIndex;
  }
  if (pos != text.length) {
    const codepoint = String.fromCodePoint(text.codePointAt(pos)!);
    throw new SourceError(
      { sourcePos: sourcePos + pos, text: codepoint },
      `unexpected character ${JSON.stringify(codepoint)}`,
    );
  }
  return result;
}

/** Parse an integer, and throw for any non-integer parts of the chunk. */
export function parseIntExact(chunk: Chunk): number {
  const { text, sourcePos } = chunk;
  if (!/^[-+]?\d+/.test(chunk.text)) {
    throw new SourceError(chunk, 'invalid number');
  }
  const n = parseInt(text, 10);
  if (!isFinite(n)) {
    throw new SourceError(chunk, 'number is out of range');
  }
  return n;
}

/**
 * Parse a floating-point number, and throw for any non-number parts of the
 * chunk.
 */
export function parseFloatExact(chunk: Chunk): number {
  if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(chunk.text)) {
    throw new SourceError(
      chunk,
      `invalid floating-point number: ${JSON.stringify(chunk.text)}`,
    );
  }
  const num = parseFloat(chunk.text);
  if (!isFinite(num)) {
    throw new SourceError(
      chunk,
      `floating-point number out of range: ${JSON.stringify(chunk.text)}`,
    );
  }
  return num;
}

/** Parse a numeric fraction or number. */
export function parseFraction(chunk: Chunk): number {
  const slash = chunk.text.indexOf('/');
  if (slash != -1) {
    const num = parseFloatExact({
      text: chunk.text.substring(0, slash),
      sourcePos: chunk.sourcePos,
    });
    const denom = parseFloatExact({
      text: chunk.text.substring(slash + 1),
      sourcePos: chunk.sourcePos + slash + 1,
    });
    if (denom == 0) {
      throw new SourceError(chunk, 'divide by zero');
    }
    const result = num / denom;
    if (!isFinite(result)) {
      throw new SourceError(chunk, 'overflow');
    }
    return result;
  }
  return parseFloatExact(chunk);
}
