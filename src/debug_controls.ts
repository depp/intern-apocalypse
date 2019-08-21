import * as dat from 'dat.gui';

/** Settings for debug view. */
export const debugView = {
  level: false,
  centroids: false,
  player: false,
};

if (dat) {
  const gui = new dat.GUI({
    name: 'Internship',
  });
  gui.add(debugView, 'level');
  gui.add(debugView, 'centroids');
  gui.add(debugView, 'player');
}
