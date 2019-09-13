/**
 * Main game loop and initialization.
 */

import { playSound, playMusic } from './audio/audio';
import { updateCamera } from './game/camera';
import { startInput, endFrameInput, buttonPress, Button } from './lib/input';
import { spawnPlayer } from './game/player';
import { render } from './render/render';
import { State, currentState, setState } from './lib/global';
import {
  startMenu,
  pushMenu,
  popMenu,
  clearUI,
  startHUD,
  MenuItem,
  playClickSound,
} from './render/ui';
import { spawnMonster } from './game/monster';
import { Difficulty, setDifficulty } from './game/difficulty';
import { vector } from './lib/math';
import { resetGame, updateGame } from './game/game';
import { updateTime } from './game/time';
import { MusicTracks } from './audio/sounds';
import { setGameTimeout } from './game/entity';
import { createBaseLevel, createForest } from './game/world';
import { spawnNPC } from './game/npc';

/** Handle when the game loses focus. */
function loseFocus(): void {
  if (currentState == State.Game) {
    setState(State.GameMenu);
  }
}

/**
 * Initialize game.
 */
export function initialize(): void {
  window.addEventListener('blur', loseFocus);
  startInput();
  resetGame();
  createForest();
}

/** The game state as of the last frame. */
let lastState: State | undefined;

/** Show the loading screen or main menu. */
function startFrontMenu(...items: MenuItem[]): void {
  startMenu(
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

/** Show the loading screen. */
function startLoadingMenu(): void {
  startFrontMenu({ text: 'Loading...' });
}

/** Show the main menu. */
function startMainMenu(): void {
  startFrontMenu({ text: 'New Game', click: pushNewGameMenu });
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

function startGameMenu(): void {
  startMenu(
    { text: 'Paused', size: 1.5 },
    { space: 32 },
    { text: 'Resume', click: popMenu },
    { text: 'End Game', click: () => setState(State.MainMenu) },
  );
}

function startDeadMenu(): void {
  startMenu(
    { text: 'You Have Died.', size: 2 },
    { text: 'This will be reflected on your performance review.' },
    { space: 96 },
    { text: 'New Game', click: pushNewGameMenu },
    { text: 'Exit', click: () => setState(State.MainMenu) },
  );
}

/** Start a new game. */
export function newGame(difficulty: Difficulty): void {
  setState(State.Game);
  setDifficulty(difficulty);
  resetGame();
  spawnPlayer(vector(0, 0));
  spawnMonster(vector(-9, -9));
  spawnMonster(vector(-2, 9));
  spawnMonster(vector(6, -9));
  spawnNPC(vector(0, -5));
  playMusic(MusicTracks.Sylvan);
}

/**
 * Main update loop.
 *
 * @param curTimeMS Current time in milliseconds.
 */
export function main(curTimeMS: DOMHighResTimeStamp): void {
  updateTime(curTimeMS);
  if (buttonPress[Button.Menu]) {
    switch (currentState) {
      case State.MainMenu:
      case State.DeadMenu:
      case State.GameMenu:
        popMenu(true);
        break;
      case State.Game:
        setState(State.GameMenu);
        playClickSound();
        break;
      case State.Dead:
        setState(State.DeadMenu);
        playClickSound();
        break;
    }
  }
  if (currentState != lastState) {
    switch (currentState) {
      case State.Loading:
        startLoadingMenu();
        break;
      case State.MainMenu:
        startMainMenu();
        break;
      case State.Game:
        startHUD();
        break;
      case State.GameMenu:
        startGameMenu();
        break;
      case State.Dead:
        clearUI();
        setGameTimeout(3, () => setState(State.DeadMenu));
        break;
      case State.DeadMenu:
        startDeadMenu();
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
