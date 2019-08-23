import * as datTypes from 'dat.gui';

/** Settings for debug view. */
export const debugView = {
  level: true,
  centroids: false,
  player: true,
};

// This looks the way it does because we want to avoid importing dat at runtime,
// which will fail for release builds. It is easier to never import than
// conditionally import.
if ('dat' in window) {
  // @ts-ignore
  const dat = window.dat as typeof datTypes;
  const gui = new dat.GUI({
    name: 'Internship',
  });
  gui.add(debugView, 'level');
  gui.add(debugView, 'centroids');
  gui.add(debugView, 'player');
}
