/**
 * Stream management functions for Node.
 */

import { Readable } from 'stream';

/**
 * Read from a stream and return the result as a promise.
 */
export function readStream(stream: Readable): Promise<string> {
  // As a side note, using Promise with Node requires so many helpers like this,
  // and it shouldn't.
  stream.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', chunk => {
      if (typeof chunk != 'string') {
        reject(new Error('not a string stream'));
        return;
      }
      data += chunk;
    });
    stream.on('end', () => resolve(data));
    stream.on('error', err => reject(err));
  });
}
