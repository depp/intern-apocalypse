# Internship at the Apocalypse

“They are on a quest to save the world. You… are heading back to town to get them more potions.”

A game being made for [JS13KGames 2019](http://js13kgames.com/) by Dietrich Epp (Twitter: [@DietrichEpp](https://twitter.com/DietrichEpp)). The goal is to create a game which runs in the browser and is no larger than 13 KiB compressed.

## Technical Details

The game is written in TypeScript and uses WebGL for graphics. It should run in recent versions of Firefox (version 68) and Chrome (version 76), other browsers are not a priority.

## Building

To build the project,

```shell
yarn install
yarn run build
```

This will create two files:

- `build/index.html`: The game, in a self-contained HTML file.
- `build/InternApocalypse_JS13K.zip`: The game, packaged for submission to JS13K.

### Build script options

- `--config=release`: Build a non-minified version of the game, `build/InternApocalypse_JS13K.zip`.
- `yarn run build watch`: Rebuild continuously as sources change.
- `yarn run build serve`: Seve the game from a local development server, rebuilding the game as the sources change. This will also stream data files to the game as they change, so the results can be seen without reloading the game.

### Checking for Errors

To check the source code for TypeScript type errors,

```shell
yarn run check-game
yarn run check-tools
```

## Audio

Audio scripts are stored in the `audio` directory. You can compile and play them from the command line. For example:

```shell
yarn run audio audio/clang.lisp --play
```

### Audio script options

- `--disassemble`: Show the disassembled audio program.
- `--output=<file>`: Write audio to an output WAVE file.
- `--play`: Play the resulting audio.
- `--loop`: Play the audio repeatedly, reloading as the input changes.

## Models

The models are stored in the `model` directory. To convert a model to compact format,

```shell
yarn run model model/sword.txt
```

## License

Internship at the Apocalypse is released under the terms of the MIT License. See [LICENSE.txt](LICENSE.txt) for details.
