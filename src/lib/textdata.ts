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
      sourcePos + pos,
      sourcePos + pos + codepoint.length,
      `unexpected character ${JSON.stringify(codepoint)}`,
    );
  }
  return result;
}
