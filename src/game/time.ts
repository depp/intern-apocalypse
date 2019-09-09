import { clamp } from '../lib/util';

/**
 * Information about time.
 *
 * In general, time is measured in seconds. The exception is code that uses the
 * DOM API, which uses Milliseconds in most places.
 */

/**
 * Maximum time delta in milliseconds. If two successive frames are farther
 * apart, the frame delta is clamped to this value.
 */
const maxDeltaTimeMS = 250;

/** Time since last update, in seconds. */
export let frameDT: number;

/** Timestamp of the last frame update, in milliseconds. */
let lastTimeMS: DOMHighResTimeStamp = 0;

/** Time since level start. */
export let levelTime: number = 0;

/** Reset the time since level start. */
export function resetTime(): void {
  levelTime = 0;
}

/**
 * Update the current time.
 *
 * @param curTimeMS The current time, in milliseconds.
 */
export function updateTime(curTimeMS: DOMHighResTimeStamp): void {
  frameDT = lastTimeMS
    ? clamp(curTimeMS - lastTimeMS, 0, maxDeltaTimeMS) * 1e-3
    : 0;
  lastTimeMS = curTimeMS;
  levelTime += frameDT;
}
