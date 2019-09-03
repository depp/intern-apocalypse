import * as readline from 'readline';

import chalk from 'chalk';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function parseColor(text: string): number[] | null {
  const result: number[] = [];
  const match = text.match(/^#?([a-fA-F0-9]{6})$/);
  if (match) {
    for (let i = 0; i < 3; i++) {
      result.push(parseInt(match[1].substring(i * 2, i * 2 + 2), 16) >> 5);
    }
  } else if (/^[0-7]{3}$/.test(text)) {
    for (let i = 0; i < 3; i++) {
      result.push(parseInt(text[i], 10));
    }
  } else {
    return null;
  }
  return result;
}

function showColor(text: string): void {
  text = text.trim();
  const color = parseColor(text);
  if (color == null) {
    console.error(`Could not parse color: ${JSON.stringify(text)}`);
    return;
  }
  const full = color.map(n => (n << 5) | (n << 2) | (n >> 1));
  const small = color.map(n => n.toString()).join('');
  const hex = '#' + full.map(n => n.toString(16).padStart(2, '0')).join('');
  let msg = `color ${small} ${hex}`;
  if (chalk.supportsColor.has256) {
    const bg = chalk.bgRgb(...(full as [number, number, number]));
    msg += ` [${bg('  ')}]`;
  }
  console.log(msg);
}

function loop() {
  rl.question('Enter color: ', answer => {
    showColor(answer);
    setImmediate(loop);
  });
}

loop();
