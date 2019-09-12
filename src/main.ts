/**
 * Main game loop and initialization.
 */

import { playSound } from './audio/audio';
import { updateCamera } from './game/camera';
import { startInput, endFrameInput } from './lib/input';
import { spawnPlayer } from './game/player';
import { render } from './render/render';
import { State, currentState, setState } from './lib/global';
import {
  startMenu,
  pushMenu,
  endMenu,
  popMenu,
  startHUD,
  MenuItem,
} from './render/ui';
import { spawnMonster } from './game/monster';
import { Difficulty, setDifficulty } from './game/difficulty';
import { vector } from './lib/math';
import { resetGame, updateGame } from './game/game';
import { updateTime } from './game/time';
import { MusicTracks } from './audio/sounds';
import { setGameTimeout } from './game/entity';

/**
 * Initialize game.
 */
export function initialize(): void {
  startInput();
  resetGame();
}

/** The game state as of the last frame. */
let lastState: State | undefined;

function pushFrontMenu(...items: MenuItem[]): void {
  pushMenu(
    { space: 32 },
    {
      text: "I Want to Help Fight the Demon Overlord, but I'm Just an Intern!",
      size: 1.8,
    },
    { flexspace: 1 },
    ...items,
    { flexspace: 1 },
    { text: 'Made for JS13K 2019 by @DietrichEpp', size: 0.5 },
  );
}

function pushLoadingMenu(): void {
  pushFrontMenu({ text: 'Loading...' });
}

/** Show the main menu. */
function pushMainMenu(): void {
  pushFrontMenu({ text: 'New Game', click: pushNewGameMenu });
}

/** Show the new game menu. */
function pushNewGameMenu(): void {
  pushMenu(
    { flexspace: 1 },
    { text: 'Select Difficulty', size: 1.5 },
    { space: 32 },
    { text: 'Plucky Comic Relief', click: () => newGame(Difficulty.Easy) },
    { text: 'Stalwart Hero', click: () => newGame(Difficulty.Normal) },
    { text: 'Tragic Legend', click: () => newGame(Difficulty.Hard) },
    { flexspace: 1 },
    { text: 'Back', click: popMenu },
  );
}

function pushDeadMenu(): void {
  pushMenu(
    { text: 'You Have Died.', size: 2 },
    { text: 'This will be reflected on your performance review.' },
  );
}

/** Start a new game. */
export function newGame(difficulty: Difficulty): void {
  setState(State.Game);
  setDifficulty(difficulty);
  resetGame();
  spawnPlayer();
  spawnMonster(vector(-9, -9));
  spawnMonster(vector(-2, 9));
  spawnMonster(vector(6, -9));
  spawnMonster(vector(2, 0));
  playSound(MusicTracks.Sylvan);
}

/**
 * Main update loop.
 *
 * @param curTimeMS Current time in milliseconds.
 */
export function main(curTimeMS: DOMHighResTimeStamp): void {
  updateTime(curTimeMS);
  if (currentState != lastState) {
    switch (currentState) {
      case State.Loading:
        startMenu();
        pushLoadingMenu();
        break;
      case State.MainMenu:
        startMenu();
        pushMainMenu();
        break;
      case State.Game:
        endMenu();
        startHUD();
        break;
      case State.Dead:
        setGameTimeout(3, () => setState(State.DeadMenu));
        break;
      case State.DeadMenu:
        startMenu();
        pushDeadMenu();
        break;
    }
    lastState = currentState;
  }
  if (currentState == State.Game || currentState == State.Dead) {
    updateGame();
  }
  updateCamera();
  endFrameInput();
  render();
}
