/**
 * Access to variables in the fragment (location.hash).
 */

/** Variables in the URL fragment identifier. */
export const hashVariables = new Map<string, string>();

/** Parse variables in the fragment identifier */
export function parseHash(): void {
  const { hash } = location;
  if (!hash.startsWith('#')) {
    return;
  }
  for (const item of hash.substring(1).split('&')) {
    let key: string;
    let value: string;
    const equal = item.indexOf('=');
    if (equal == -1) {
      key = item;
      value = '';
    } else {
      key = item.substring(0, equal);
      value = item.substring(equal + 1);
    }
    try {
      key = decodeURIComponent(key);
      value = decodeURIComponent(value);
    } catch (e) {
      console.error(e);
      continue;
    }
    hashVariables.set(key, value);
  }
}
