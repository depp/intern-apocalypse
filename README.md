# Internship at the Apocalypse

“They are on a quest to save the world. You… are heading back to town to get them more potions.”

A game being made for [JS13KGames 2019](http://js13kgames.com/) by Dietrich Epp (Twitter: [@DietrichEpp](https://twitter.com/DietrichEpp)). The goal is to create a game which runs in the browser and is no larger than 13 KiB compressed.

## Technical Details

The game is written in TypeScript and uses WebGL for graphics. It should run in recent versions of Firefox (version 68) and Chrome (version 76), other browsers are not a priority.

## Building

To build the project,

```shell
yarn install
./node_modules/.bin/ts-node tools/build.ts
```

This will create two files:

- `build/index.html`: The game, in a self-contained HTML file.
- `build/InternApocalypse.zip`: The game, packaged for submission to JS13K.

The build script accepts the parameter `--watch`, which causes it to continuously rebuild as the input files change.

## License

Internship at the Apocalypse is released under the terms of the MIT License. See [LICENSE.txt](LICENSE.txt) for details.
