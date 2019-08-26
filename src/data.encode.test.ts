import { decode, encode } from './data.encode';

describe('encode', () => {
  const inputs: Uint8Array[] = [
    new Uint8Array([91, 0]),
    new Uint8Array(Array(92).keys()),
  ];
  for (let i = 0; i < inputs.length; i++) {
    test(`test${i}`, () => {
      const data = inputs[i];
      const encoded = encode(data);
      const decoded = decode(encoded);
      expect(decoded.length).toBe(data.length);
      for (let j = 0; j < data.length; j++) {
        if (data[j] != decoded[j]) {
          throw new Error('failed');
        }
      }
    });
  }
});
