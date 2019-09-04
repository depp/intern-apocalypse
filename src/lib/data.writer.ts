import { dataMax } from './data.encode';
import { AssertionError } from '../debug/debug';

/** A buffer for writing data to be included in the game. */
export class DataWriter {
  private buffer = new Uint8Array(128);
  private pos: number = 0;

  clear(): void {
    this.pos = 0;
  }

  write(...data: number[]): void {
    this.writeArray(data);
  }

  writeArray(data: ArrayLike<number>): void {
    for (let i = 0; i < data.length; i++) {
      const n = data[i];
      if (n < 0 || n > dataMax) {
        throw new AssertionError(`data out of range: ${JSON.stringify(n)}`);
      }
      if (n != (n | 0)) {
        throw new AssertionError(`not an integer: ${JSON.stringify(n)}`);
      }
    }
    const avail = this.buffer.length - this.pos;
    if (data.length > avail) {
      let newsize = this.buffer.length * 2;
      while (data.length > newsize - this.pos) {
        newsize *= 2;
      }
      const newbuf = new Uint8Array(newsize);
      newbuf.set(this.buffer.subarray(0, this.pos));
      this.buffer = newbuf;
    }
    this.buffer.set(data, this.pos);
    this.pos += data.length;
  }

  getData(): Uint8Array {
    return this.buffer.slice(0, this.pos);
  }
}
