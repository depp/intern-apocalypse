/** Generic interface for typed arrays. */
export interface TypedArray extends ArrayLike<number> {
  set(array: ArrayLike<number>, offset?: number): void;
}

/** Concatenate many typed arrays into a single typed array. */
export function concatArrays<T extends TypedArray>(
  constructor: new (length: number) => T,
  arrays: readonly T[],
): T {
  let n = 0;
  for (const arr of arrays) {
    n += arr.length;
  }
  const r = new constructor(n);
  let i = 0;
  for (const arr of arrays) {
    r.set(arr, i);
    i += arr.length;
  }
  return r;
}
