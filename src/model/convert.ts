/**
 * Code for converting models from text format.
 */

import { SourceError, SourceSpan } from '../lib/sourcepos';
import {
  chunkEnd,
  splitLines,
  splitFields,
  parseIntExact,
  Chunk,
} from '../lib/textdata';
import { dataMax } from '../lib/data.encode';
import { DataWriter } from '../lib/data.writer';
import { AssertionError } from '../debug/debug';

/** Maximum number of different points in a model. */
const maxPoints = dataMax - 7;

/** Opcodes for the model binary stream. */
enum Opcode {
  Color,
  Symmetry,
  Face3,
}

/** Kinds of items in the parsed model. */
enum Kind {
  Point,
  Face,
  Color,
  Symmetry,
}

/** Base type for items in a parsed model. */
interface ItemBase {
  kind: Kind;
  loc: SourceSpan;
}

/** A parsed point in the model. */
interface Point extends ItemBase {
  kind: Kind.Point;
  name: string;
  coords: number[];
}

/** A reference to a point. */
interface PointRef {
  name: Chunk;
  flags: number;
}

/** A parsed face in the model. */
interface Face extends ItemBase {
  kind: Kind.Face;
  points: PointRef[];
}

/** A parsed color in the model. */
interface Color extends ItemBase {
  kind: Kind.Color;
  color: number[];
}

/** A parsed symmetry directive in the model. */
interface Symmetry extends ItemBase {
  kind: Kind.Symmetry;
  flags: number;
}

type Item = Point | Face | Color | Symmetry;

/** Parse a field that contains a color. */
function parseColorField(chunk: Chunk): number[] {
  const { text } = chunk;
  const arr: number[] = [];
  switch (text.length) {
    case 3:
      for (let i = 0; i < 3; i++) {
        const t = text[i];
        const n = parseInt(t, 16);
        if (!isFinite(n)) {
          throw new SourceError(
            chunk,
            `color has invalid number ${JSON.stringify(t)}`,
          );
        }
        arr.push(n | (n << 4));
      }
      break;
    case 6:
      for (let i = 0; i < 3; i++) {
        const t = text.substring(i * 2, i * 2 + 2);
        const n = parseInt(t, 16);
        if (!isFinite(n)) {
          throw new SourceError(
            chunk,
            `color has invalid number ${JSON.stringify(t)}`,
          );
        }
        arr.push(n);
      }
      break;
    default:
      throw new SourceError(
        chunk,
        `color has length ${text.length}, should be 3 or 6`,
      );
  }
  return arr;
}

/** Parse symmetry, and return the flags. */
function parseSymmetryFlags(sourcePos: number, text: string): number {
  let flags = 0;
  for (const c of text) {
    const i = 'xyz'.indexOf(c);
    if (i == -1) {
      throw new SourceError(
        { text, sourcePos },
        `unknown axis ${JSON.stringify(c)}`,
      );
    }
    const mask = 1 << i;
    if ((flags & mask) != 0) {
      throw new SourceError(
        { text, sourcePos },
        `duplicate axis ${JSON.stringify(c)}`,
      );
    }
    flags |= mask;
  }
  return flags;
}

type ItemParser = (loc: SourceSpan, fields: Chunk[]) => Item;

const itemTypes = new Map<string, ItemParser>();

/** Define a type of item in the model source. */
function deftype(name: string, parser: ItemParser): void {
  if (itemTypes.has(name)) {
    throw new AssertionError(`duplicate name ${JSON.stringify(name)}`);
  }
  itemTypes.set(name, parser);
}

/** Regular expression for valid names in a model. */
const validName = /^[_A-Za-z][_A-Za-z0-9]*$/;

/** Parse a point in the model text. */
deftype('p', function parsePoint(loc: SourceSpan, fields: Chunk[]): Item {
  if (fields.length != 4) {
    throw new SourceError(
      loc,
      `point requires 4 arguments (name x y z), given ${fields.length}`,
    );
  }
  const name = fields[0].text;
  if (!validName.test(name)) {
    throw new SourceError(fields[1], 'invalid point name');
  }
  const coords: number[] = [];
  for (let i = 1; i < 4; i++) {
    coords.push(parseIntExact(fields[i]));
  }
  return { kind: Kind.Point, loc, name, coords };
});

/** Parse a face in the model text. */
deftype('f', function parseFace(loc: SourceSpan, fields: Chunk[]): Item {
  if (fields.length < 3) {
    throw new SourceError(
      loc,
      `face requires at least 3 points, given ${fields.length - 1}`,
    );
  }
  const points: PointRef[] = [];
  for (let { text, sourcePos } of fields) {
    const dot = text.indexOf('.');
    let flags = 0;
    if (dot != -1) {
      if (dot == text.length) {
        throw new SourceError(fields[dot], 'point reference has empty flags');
      }
      flags = parseSymmetryFlags(sourcePos + dot + 1, text.substring(dot + 1));
      text = text.substring(0, dot);
    }
    if (!validName.test(text)) {
      throw new SourceError({ text, sourcePos }, 'invalid point name');
    }
    points.push({ name: { text, sourcePos }, flags });
  }
  return { kind: Kind.Face, loc, points };
});

deftype('color', function parseColor(loc: SourceSpan, fields: Chunk[]): Item {
  if (fields.length != 1) {
    throw new SourceError(
      loc,
      `color requires 1 argument (color), given ${fields.length}`,
    );
  }
  const color = parseColorField(fields[0]);
  return { kind: Kind.Color, loc, color };
});

deftype('symmetry', function parseSymmetry(
  loc: SourceSpan,
  fields: Chunk[],
): Item {
  if (fields.length != 1) {
    throw new SourceError(
      loc,
      `symmetry requires 1 argument (symmetry), given ${fields.length}`,
    );
  }
  const flags = parseSymmetryFlags(fields[0].sourcePos, fields[0].text);
  return { kind: Kind.Symmetry, loc, flags };
});

/** Read the directives in a model. */
function readModel(source: string): Item[] {
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
    const head = fields[0];
    fields.shift();
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

interface Bounds {
  min: number;
  max: number;
}

/** Get the bounds of points along a given axes. */
function bounds1(points: Point[], axis: number): Bounds {
  let min = 0;
  let max = 1;
  if (points.length > 0) {
    min = max = points[0].coords[axis];
    for (let i = 1; i < points.length; i++) {
      const v = points[i].coords[axis];
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  return { min, max };
}

/** Get the bounding box containing the given points. */
function bounds(points: Point[]): Bounds[] {
  return Array(3)
    .fill(0)
    .map(axis => bounds1(points, axis));
}

/** Map from point names to indexes. */
type PointNames = ReadonlyMap<string, number>;

/**
 * Write point data to binary format. Returns a map from point name to index.
 */
function writePoints(w: DataWriter, items: Item[]): PointNames {
  const points: Point[] = [];
  for (const item of items) {
    if (item.kind == Kind.Point) {
      points.push(item);
    }
  }
  if (points.length > maxPoints) {
    throw new SourceError(
      points[maxPoints].loc,
      `too many points, there are ${points.length} points` +
        ` but the maximum is ${maxPoints}`,
    );
  }
  w.write(points.length);
  const pbounds = bounds(points);
  const x0 = pbounds[0].min;
  const y0 = pbounds[0].min;
  const z0 = pbounds[0].min;
  w.write(x0, y0, z0);
  const names = new Map<string, number>();
  for (let i = 0; i < points.length; i++) {
    const { loc, name, coords } = points[i];
    if (names.has(name)) {
      throw new SourceError(loc, `duplicate name ${JSON.stringify(name)}`);
    }
    let [x, y, z] = coords;
    x -= x0;
    y -= y0;
    z -= z0;
    if (x > dataMax || y > dataMax || z > dataMax) {
      throw new SourceError(loc, 'point out of range for encoding');
    }
    w.write(x, y, z);
    names.set(name, i);
  }
  return names;
}

/** Encode an 8-bit number using the full range 0..dataMax. */
function encode8(n: number): number {
  const x = (n * (dataMax + 1)) >> 8;
  if (x <= 0) {
    return 0;
  } else if (x >= dataMax) {
    return dataMax;
  } else {
    return x;
  }
}

/** Write a point reference to the stream. */
function writePointRef(
  w: DataWriter,
  point: PointRef,
  names: PointNames,
): void {
  const { name, flags } = point;
  const index = names.get(name.text);
  if (index == null) {
    throw new SourceError(name, `undefined point ${JSON.stringify(name.text)}`);
  }
  if (flags) {
    w.write(maxPoints + flags);
  }
  w.write(index);
}

/** Write a face to the stream. */
function writeFace(w: DataWriter, item: Face, names: PointNames): void {
  const { points } = item;
  if (points.length < 3) {
    throw new SourceError(
      item.loc,
      `face needs at least 3 points, has ${points.length}`,
    );
  }
  const maxSize = 10;
  if (points.length > maxSize) {
    throw new SourceError(
      item.loc,
      `face cannot have more than ${maxSize} points, has ${points.length}`,
    );
  }
  w.write(Opcode.Face3 + (points.length - 3));
  for (const point of points) {
    writePointRef(w, point, names);
  }
}

/** Write a color to the data stream. */
function writeColor(w: DataWriter, item: Color): void {
  const { color } = item;
  if (color.length != 3) {
    throw new AssertionError(`bad color length: ${color.length}`);
  }
  w.write(Opcode.Color);
  w.writeArray(color.map(encode8));
}

/** Write symmetry info to the data stream. */
function writeSymmetry(w: DataWriter, item: Symmetry): void {
  w.write(Opcode.Symmetry, item.flags);
}

/** Write all face data to the stream. */
function writeFaces(w: DataWriter, items: Item[], names: PointNames): void {
  for (const item of items) {
    switch (item.kind) {
      case Kind.Color:
        writeColor(w, item);
        break;
      case Kind.Face:
        writeFace(w, item, names);
        break;
      case Kind.Symmetry:
        writeSymmetry(w, item);
        break;
    }
  }
}

/** Convert a model from source format to binary format. */
export function convertModel(source: string): Uint8Array {
  const items = readModel(source);
  const w = new DataWriter();
  const names = writePoints(w, items);
  writeFaces(w, items, names);
  return w.getData();
}
