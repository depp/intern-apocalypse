import * as fs from 'fs';
import * as Handlebars from 'handlebars';

/** Escape JavaScript for embedding in script tag. */
function inlineJavaScript(js: string): Handlebars.SafeString {
  return new Handlebars.SafeString(
    js.replace('</script', '<\\/script').replace('<!--', '<\\!--'),
  );
}

async function main() {
  const templateSrc = await fs.promises.readFile('src/index.html', {
    encoding: 'utf8',
  });
  const template = Handlebars.compile(templateSrc);
  const html = template({
    title: 'Internship at the Apocalypse',
    script: inlineJavaScript("console.log('dummy text');"),
  });
  try {
    await fs.promises.mkdir('build');
  } catch (e) {
    if (e.code != 'EEXIST') {
      throw e;
    }
  }
  await fs.promises.writeFile('build/index.html', html, {
    encoding: 'utf8',
  });
}

main();
