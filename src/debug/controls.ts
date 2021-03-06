import * as datTypes from 'dat.gui';

import { debugView, cameraSettings, playerSettings } from '../lib/settings';

// =============================================================================
// Settings
// =============================================================================

/** Default settings for debug view. */
const debugViewDefaults = Object.assign({}, debugView);

/** Default settings for the camera. */
const cameraDefaults = Object.assign({}, cameraSettings);

/** Default settings for player movement. */
const playerDefaults = Object.assign({}, playerSettings);

// =============================================================================
// Load / Save / UI
// =============================================================================

/** Key for storing debug settings in local storage. */
const localStorageKey = 'us.moria.intern-apocalypse';

/** A settings section. */
interface Section {
  readonly name: string;
  readonly currentValues: any & object;
  readonly defaultValues: any & object;
}

/** Create a settings section. */
function section<T extends object>(
  name: string,
  currentValues: T,
  defaultValues: T,
): Section {
  return { name, currentValues, defaultValues };
}

/** List of all settings sections. */
const categories: readonly Section[] = [
  section('debugView', debugView, debugViewDefaults),
  section('camera', cameraSettings, cameraDefaults),
  section('player', playerSettings, playerDefaults),
];

/** Save debug settings to local storage. */
function saveSettings(): void {
  const saved: any & object = {};
  let savedHasData = false;
  for (const { name, currentValues, defaultValues } of categories) {
    const obj: any & object = {};
    let objHasData = false;
    for (const key of Object.keys(defaultValues)) {
      const defaultValue = defaultValues[key];
      const currentValue = currentValues[key];
      if (currentValue != defaultValue) {
        obj[key] = currentValue;
        objHasData = true;
      }
    }
    if (objHasData) {
      saved[name] = obj;
      savedHasData = true;
    }
  }
  if (savedHasData) {
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
  for (const { name, currentValues, defaultValues } of categories) {
    Object.assign(currentValues, defaultValues);
    const obj = saved[name];
    if (obj && typeof obj == 'object' && !Array.isArray(obj)) {
      for (const key of Object.keys(obj)) {
        if (Object.prototype.hasOwnProperty.call(defaultValues, key)) {
          const value = obj[key];
          if (typeof value == typeof defaultValues[key]) {
            currentValues[key] = value;
          }
        }
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
  const gui = new dat.GUI();
  function folder<T extends object>(
    name: string,
    data: T,
    defaults: T,
    func: (gui: datTypes.GUI, data: T) => void,
  ): void {
    const folder = gui.addFolder(name);
    folder.add(
      {
        reset() {
          Object.assign(data, defaults);
          folder.updateDisplay();
          didChange();
        },
      },
      'reset',
    );
    func(folder, createProxy(data));
  }
  loadSettings();

  folder('Layers', debugView, debugViewDefaults, (gui, data) => {
    gui.add(data, 'slowDown', 1, 10);
    gui.add(data, 'level');
    gui.add(data, 'centroids');
    gui.add(data, 'entities');
    gui.add(data, 'coordinates');
  });

  folder('Camera', cameraSettings, cameraDefaults, (gui, data) => {
    gui.add(data, 'distance', 1, 50);
    gui.add(data, 'elevation', 0.5, 2);
    gui.add(data, 'zoom', 1, 5);
    gui.add(data, 'zNear', 0.1, 5.0);
    gui.add(data, 'zFar', 10.0, 100.0);
    gui.add(data, 'speed', 0, 20);
    gui.add(data, 'border', 0, 20);
  });

  folder('Player', playerSettings, playerDefaults, (gui, data) => {
    gui.add(data, 'speed', 1, 10);
    gui.add(data, 'acceleration', 5, 50);
    gui.add(data, 'turnSpeed', 5, 30);
    gui.add(data, 'attackTime', 0.1, 0.5);
  });
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
