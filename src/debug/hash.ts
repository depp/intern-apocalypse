/**
 * Access to variables in the fragment (location.hash).
 */

interface HashVariables {
  /** If set, show the given model in the model viewer. */
  model: string | null;
  /** If true, skip the menu and start the game. */
  game: boolean;
  /** Difficulty to start game with, if skipping the menu. */
  difficulty: number;
  /** If true, log assets loaded. */
  logAssets: boolean;
  /** Level to start at. */
  level: number;
}

/** Variables in the URL fragment identifier. */
export const hashVariables: HashVariables = {
  model: null,
  game: false,
  difficulty: 1,
  logAssets: false,
  level: 0,
};

/** Parse variables in the fragment identifier */
export function parseHash(): void {
  const { hash } = location;
  if (!hash.startsWith('#')) {
    return;
  }
  const parsers = new Map<string, (value: string) => boolean>();
  function parser(name: string, func: (value: string) => boolean): void {
    parsers.set(name, func);
  }
  parser('model', value => {
    hashVariables.model = value;
    return true;
  });
  parser('game', value => {
    if (value != '') {
      return false;
    }
    hashVariables.game = true;
    return true;
  });
  parser('difficulty', value => {
    if (!/^[0-9]+$/.test(value)) {
      return false;
    }
    const ivalue = parseInt(value, 10);
    if (ivalue < 0 || 2 < ivalue) {
      return false;
    }
    hashVariables.difficulty = ivalue;
    return true;
  });
  parser('logassets', value => {
    if (value != '') {
      return false;
    }
    hashVariables.logAssets = true;
    return true;
  });
  parser('level', value => {
    hashVariables.level = parseInt(value);
    return true;
  });
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
    const func = parsers.get(key);
    if (func == null) {
      throw new Error(`Unknown hash parameter: ${JSON.stringify(key)}`);
    }
    if (!func(value)) {
      throw new Error(
        `Bad value for ${JSON.stringify(key)}: ${JSON.stringify(value)}`,
      );
    }
  }
}
