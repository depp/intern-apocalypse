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
  parseFraction,
} from '../lib/textdata';
import { dataMax, encodeExponential, toDataClamp } from '../lib/data.encode';
import { DataWriter } from '../lib/data.writer';
import { AssertionError } from '../debug/debug';
import { Opcode } from './defs';

/**
 * Model data axis permutation.
 *
 * This is a kludge.
 *
 * The models are created with +Z forward, +Y up, and +X to their left. The
 * models were originally created this way because it seems very natural, with
 * the moadel's outline laid out on the XY plane. However, the game world uses
 * +Z as up. So we permute the data in the models so that the actual data files
 * will have +X as forward, +Y as left, and +Z as up. This makes it much easier
 * to get the transforms for the models correct in the code.
 *
 * Note that this is an even permutation, so we don't have to fix winding order.
 */
const axisPermutation: readonly number[] = [1, 2, 0];

/** Maximum number of different points in a model. */
const maxPoints = dataMax - 7;

/** Kinds of items in the parsed model. */
enum Kind {
  Point,
  Face,
  Color,
  Symmetry,
  Origin,
  Scale,
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

/** A parsed origin directive in the model. */
interface Origin extends ItemBase {
  kind: Kind.Origin;
  origin: number[];
}

/** A parsed scale directive in the model. */
interface Scale extends ItemBase {
  kind: Kind.Scale;
  scale: number[];
}

type Item = Point | Face | Color | Symmetry | Origin | Scale;

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

/** Parse a list of axes, and return the flags. */
function parseAxes(chunk: Chunk): number {
  let flags = 0;
  for (const c of chunk.text) {
    const i = 'xyz'.indexOf(c);
    if (i == -1) {
      throw new SourceError(chunk, `unknown axis ${JSON.stringify(c)}`);
    }
    const mask = 1 << axisPermutation[i];
    if ((flags & mask) != 0) {
      throw new SourceError(chunk, `duplicate axis ${JSON.stringify(c)}`);
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
  const coords: number[] = [0, 0, 0];
  for (let i = 1; i < 4; i++) {
    coords[axisPermutation[i - 1]] = parseIntExact(fields[i]);
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
      flags = parseAxes({
        text: text.substring(dot + 1),
        sourcePos: sourcePos + dot + 1,
      });
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
  const flags = parseAxes(fields[0]);
  return { kind: Kind.Symmetry, loc, flags };
});

deftype('origin', function parseOrigin(loc: SourceSpan, fields: Chunk[]): Item {
  if (fields.length != 3) {
    throw new SourceError(
      loc,
      `origin requires 3 arguments (x y z), given ${fields.length}`,
    );
  }
  const origin: number[] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    origin[axisPermutation[i]] = parseIntExact(fields[i]);
  }
  return { kind: Kind.Origin, loc, origin };
});

deftype('scale', function parseScale(loc: SourceSpan, fields: Chunk[]): Item {
  const scale = [1, 1, 1];
  switch (fields.length) {
    case 1:
      {
        const value = parseFraction(fields[0]);
        for (let i = 0; i < 3; i++) {
          scale[i] = value;
        }
      }
      break;
    case 2:
      {
        const flags = parseAxes(fields[0]);
        const value = parseFraction(fields[1]);
        for (let i = 0; i < 3; i++) {
          if (flags & (1 << i)) {
            scale[i] = value;
          }
        }
      }
      break;
    case 3:
      for (let i = 0; i < 3; i++) {
        scale[axisPermutation[i]] = parseFraction(fields[i]);
      }
      break;
    default:
      throw new SourceError(
        loc,
        `scale requires 1, 2, or 3 arguments, given ${fields.length}`,
      );
  }
  return { kind: Kind.Scale, loc, scale };
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
  let max = 0;
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
    .map((_, axis) => bounds1(points, axis));
}

/** Map from point names to indexes. */
type PointNames = ReadonlyMap<string, number>;

/**
 * Write point data to binary format. Returns a map from point name to index.
 */
function writePoints(w: DataWriter, items: Item[]): PointNames {
  let hasOrigin = false;
  let origin = [0, 0, 0];
  const scale = [1, 1, 1];
  const points: Point[] = [];
  for (const item of items) {
    switch (item.kind) {
      case Kind.Point:
        points.push(item);
        break;
      case Kind.Origin:
        if (hasOrigin) {
          throw new SourceError(item.loc, 'multiple origin directives');
        }
        origin = item.origin;
        break;
      case Kind.Scale:
        for (let i = 0; i < 3; i++) {
          scale[i] *= item.scale[i];
        }
        break;
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
  const base: number[] = [];
  for (let i = 0; i < 3; i++) {
    let { min } = pbounds[i];
    if (origin[i] < min) {
      min = origin[i];
    }
    base.push(min);
    origin[i] -= min;
  }
  w.writeArray(origin);
  w.writeArray(scale.map(x => toDataClamp(encodeExponential(x))));
  const names = new Map<string, number>();
  for (let i = 0; i < points.length; i++) {
    const { loc, name, coords } = points[i];
    if (names.has(name)) {
      throw new SourceError(loc, `duplicate name ${JSON.stringify(name)}`);
    }
    for (let i = 0; i < 3; i++) {
      const coord = coords[i] - base[i];
      if (coord > dataMax) {
        throw new SourceError(loc, 'point out of range for encoding');
      }
      w.write(coord);
    }
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
