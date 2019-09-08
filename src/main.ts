/**
 * Main game loop and initialization.
 */

import { startAudio } from './audio/audio';
import { updateCamera } from './game/camera';
import { startInput, endFrameInput } from './lib/input';
import { spawnPlayer } from './game/player';
import { render } from './render/render';
import { updateTime } from './game/time';
import { updateEntities } from './game/entity';
import { State, currentState, setState } from './lib/global';
import { startMenu, endMenu } from './render/ui';
import { spawnMonster } from './game/monster';

/**
 * Initialize game.
 */
export function initialize(): void {
  startInput();
}

/** The game state as of the last frame. */
let lastState: State | undefined;

/**
 * Main update loop.
 *
 * @param curTimeMS Current time in milliseconds.
 */
export function main(curTimeMS: DOMHighResTimeStamp): void {
  if (currentState != lastState) {
    switch (currentState) {
      case State.MainMenu:
        startMenu(
          {
            click() {
              startAudio();
              setState(State.Game);
            },
          },
          {
            marginTop: 32,
            text: 'Internship',
            size: 2,
          },
          {
            text: '— at the —',
            marginTop: -20,
            marginBottom: -12,
          },
          {
            text: 'Apocalypse',
            size: 2,
          },
          {
            flexspace: 1,
          },
          {
            text: 'New Game',
          },
          {
            flexspace: 1,
          },
        );
        break;
      case State.Game:
        endMenu();
        spawnPlayer();
        spawnMonster();
        break;
    }
    lastState = currentState;
  }
  updateTime(curTimeMS);
  if (currentState == State.Game) {
    updateEntities();
  }
  updateCamera();
  endFrameInput();
  render();
}
