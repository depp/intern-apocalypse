const fs = require('fs').promises;
const Handlebars = require('handlebars');

async function main() {
  const templateSrc = await fs.readFile('src/index.html', {
    encoding: 'utf8',
  });
  const template = Handlebars.compile(templateSrc);
  const html = template({
    title: 'Internship at the Apocalypse',
    script: new Handlebars.SafeString("console.log('dummy text');"),
  });
  try {
    await fs.mkdir('build');
  } catch (e) {
    if (e.code != 'EEXIST') {
      throw e;
    }
  }
  await fs.writeFile('build/index.html', html, {
    encoding: 'utf8',
  });
}

main();
