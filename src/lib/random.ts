import { Vector, vector } from './math';

/**
 * Random number generator.
 *
 * We use a custom PRNG rather than Math.random() to make it possible to
 * generate the same levels on different browsers, since different browsers use
 * different PRNGs.
 */
export class Random {
  // This uses the Xorshift32 algorithm by George Marsaglia.

  /** The state, which can be used to manually seed. */
  state: number;

  constructor(seed?: number) {
    this.state = seed || 1;
  }

  /**
   * Return a pseudorandom integer in the range 1..2^32-1.
   */
  next(): number {
    let { state } = this;
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (this.state = state >>> 0);
  }

  /**
   * Return a pseudorandom floating-point number in the given range.
   */
  range(min: number = 0, max: number = 1): number {
    return min + this.next() * (max - min) * 2 ** -32;
  }

  /**
   * Return an integer in the range 0..limit-1.
   */
  rangeInt(limit: number) {
    return (this.next() * limit * 2 ** -32) | 0;
  }

  /** Return a random vector. */
  vector(): Vector {
    return vector(this.range(-1, 1), this.range(-1, 1));
  }
}

/** Global, shared instance of random-number generator. */
export const globalRandom = new Random(9);
