/**
 * Main game loop and initialization.
 */

import { startAudio } from './audio/audio';
import { updateCamera } from './game/camera';
import { startInput, endFrameInput } from './lib/input';
import { spawnPlayer } from './game/player';
import { render } from './render/render';
import { State, currentState, setState } from './lib/global';
import { startMenu, pushMenu, endMenu, popMenu } from './render/ui';
import { spawnMonster } from './game/monster';
import { Difficulty, setDifficulty } from './game/difficulty';
import { vector } from './lib/math';
import { resetGame, updateGame } from './game/game';
import { updateTime } from './game/time';

/**
 * Initialize game.
 */
export function initialize(): void {
  startInput();
  resetGame();
}

/** The game state as of the last frame. */
let lastState: State | undefined;

/** Show the main menu. */
function pushMainMenu(): void {
  pushMenu(
    {
      click() {
        startAudio();
      },
    },
    { space: 32 },
    {
      text: "I Want to Help Fight the Demon Overlord, but I'm Just an Intern!",
      size: 1.8,
    },
    { flexspace: 1 },
    { text: 'New Game', click: pushNewGameMenu },
    { flexspace: 1 },
    { text: 'Made for JS13K 2019 by @DietrichEpp', size: 0.5 },
  );
}

/** Show the new game menu. */
function pushNewGameMenu(): void {
  pushMenu(
    {},
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
      case State.MainMenu:
        startMenu();
        pushMainMenu();
        break;
      case State.Game:
        endMenu();
        break;
    }
    lastState = currentState;
  }
  if (currentState == State.Game) {
    updateGame();
  }
  updateCamera();
  endFrameInput();
  render();
}
