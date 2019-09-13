/**
 * Main game loop and initialization.
 */

import { updateCamera } from './game/camera';
import { startInput, endFrameInput, buttonPress, Button } from './lib/input';
import { render } from './render/render';
import { State, currentState, setState, pendingDialogue } from './lib/global';
import {
  startMenu,
  pushMenu,
  popMenu,
  clearUI,
  startHUD,
  MenuItem,
  playClickSound,
} from './render/ui';
import { Difficulty, setDifficulty } from './game/difficulty';
import { resetGame, updateGame } from './game/game';
import { updateTime, levelTime } from './game/time';
import { setGameTimeout } from './game/entity';
import { loadLevel } from './game/world';
import { AssertionError } from './debug/debug';
import {
  setLevel,
  setNextLevel,
  nextLevel,
  initialCampaignData,
  campaignData,
} from './game/campaign';

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
  setLevel(loadLevel(0));
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

let dialogueStartTime: number | undefined;

function startGameDialogue(): void {
  dialogueStartTime = levelTime;
  startMenu(
    { flexspace: 1 },
    { text: pendingDialogue, outlined: true },
    { space: 32 },
  );
}

function exitDialogue(): void {
  if (dialogueStartTime == null) {
    throw new AssertionError('dialogueStartTime == null');
  }
  if (levelTime > dialogueStartTime + 1) {
    setState(State.Game);
  }
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
  Object.assign(campaignData, initialCampaignData);
  resetGame();
  setNextLevel(0);
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
      case State.GameDialogue:
        exitDialogue();
        break;
    }
  } else if (buttonPress[Button.Select] || buttonPress[Button.Action]) {
    if (currentState == State.GameDialogue) {
      exitDialogue();
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
      case State.GameDialogue:
        startGameDialogue();
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
  if (currentState == State.Game) {
    if (nextLevel == null) {
      throw new AssertionError('nextLevel == null');
    }
    if (nextLevel >= 0) {
      const level = loadLevel(nextLevel);
      resetGame();
      setLevel(level);
    }
  }
  if (currentState == State.Game || currentState == State.Dead) {
    updateGame();
    updateGame();
  }
  updateCamera();
  endFrameInput();
  render();
}
