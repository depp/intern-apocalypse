/* A unit quad as two triangles. Index, XY, and UV coordinates. */
export const quad: readonly (readonly number[])[] = [
  [0, -1, -1, 0, 1],
  [1, 1, -1, 1, 1],
  [2, -1, 1, 0, 0],
  [3, -1, 1, 0, 0],
  [4, 1, -1, 1, 1],
  [5, 1, 1, 1, 0],
];
