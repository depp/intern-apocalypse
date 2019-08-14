/**
 * Build rules for creating HTML files.
 * @module src/html
 */

import * as fs from 'fs';

import * as Handlebars from 'handlebars';

/** Escape JavaScript for embedding in script tag. */
function inlineJavaScript(js: string): Handlebars.SafeString {
  return new Handlebars.SafeString(
    js.replace('</script', '<\\/script').replace('<!--', '<\\!--'),
  );
}

/** Build the game HTML page. */
export async function buildHTML(): Promise<void> {
  const jsSrc = fs.promises.readFile('build/game.js', 'utf8');
  const templateSrc = fs.promises.readFile('src/index.html', 'utf8');
  const template = Handlebars.compile(await templateSrc);
  const html = template({
    title: 'Internship at the Apocalypse',
    script: inlineJavaScript(await jsSrc),
  });
  await fs.promises.writeFile('build/index.html', html, {
    encoding: 'utf8',
  });
}
