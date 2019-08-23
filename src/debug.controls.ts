import * as datTypes from 'dat.gui';

/** Default settings for debug view. */
const debugViewDefaults = {
  level: false,
  centroids: false,
  player: false,
};

type DebugSettings = typeof debugViewDefaults;

/** Settings for debug view. */
export const debugView = Object.assign({}, debugViewDefaults);

/** Key for storing debug settings in local storage. */
const localStorageKey = 'us.moria.intern-apocalypse';

/** Save debug settings to local storage. */
function saveSettings(): void {
  const saved: any & object = {};
  let hasData = false;
  for (const keyValue of Object.keys(debugViewDefaults)) {
    const key = keyValue as keyof DebugSettings;
    const defaultValue = debugViewDefaults[key];
    const value = debugView[key];
    if (value != defaultValue) {
      hasData = true;
      saved[key] = value;
    }
  }
  if (hasData) {
    localStorage.setItem(localStorageKey, JSON.stringify(saved));
  } else {
    localStorage.removeItem(localStorageKey);
  }
}

/** Load debug settings from local storage. */
function loadSettings(): void {
  const savedString = localStorage.getItem(localStorageKey);
  if (!savedString) {
    return;
  }
  let saved: any;
  try {
    saved = JSON.parse(savedString);
  } catch (e) {
    console.error(e);
    return;
  }
  if (typeof saved != 'object' || Array.isArray(saved)) {
    return;
  }
  for (const key of Object.keys(debugViewDefaults)) {
    if (Object.prototype.hasOwnProperty.call(saved, key)) {
      const defaultValue = debugViewDefaults[key as keyof DebugSettings];
      const value = saved[key];
      if (typeof value == typeof defaultValue) {
        debugView[key as keyof DebugSettings] = value;
      }
    }
  }
}

/** Timeout handle for saving settings. */
let timeout: number | undefined;

/** Respond to settings changes. */
function didChange(): void {
  if (timeout == null) {
    timeout = setTimeout(() => {
      timeout = undefined;
      saveSettings();
    }, 500);
  }
}

/** Create a proxy which intercepts changes from dat.gui. */
function createProxy<T extends object>(data: T): T {
  return new Proxy(data, {
    set(target, p, value): boolean {
      if (!target.hasOwnProperty(p)) {
        return false;
      }
      didChange();
      target[p as keyof T] = value;
      return true;
    },
    deleteProperty(): boolean {
      return false;
    },
  });
}

/** Show the dat.gui controls. */
function startGUI(dat: typeof datTypes): void {
  const gui = new dat.GUI({
    name: 'Internship',
  });
  loadSettings();
  const view = createProxy(debugView);
  gui.add(view, 'level');
  gui.add(view, 'centroids');
  gui.add(view, 'player');
}

/** Show the debug GUI. */
export function startDebugGUI(): void {
  // This looks the way it does because we want to avoid importing dat at runtime,
  // which will fail for release builds. It is easier to never import than
  // conditionally import.
  if ('dat' in window) {
    startGUI(window['dat']);
  }
}
