/**
 * Build rules for creating HTML files.
 */

import * as fs from 'fs';

import { BuildContext } from './action';

import * as Handlebars from 'handlebars';

/** Escape JavaScript for embedding in script tag. */
function inlineJavaScript(js: string): Handlebars.SafeString {
  return new Handlebars.SafeString(
    js.replace('</script', '<\\/script').replace('<!--', '<\\!--'),
  );
}

/** Input to the EvalHTML build step. */
export interface EvalHTMLInput {
  /** Path to the script to embed in the HTML. */
  readonly script: string;
}

/** Output from the EvalHTML build step. */
export interface EvalHTMLOutput {
  /** Path to the HTML template output. */
  readonly html: string;
}

/**
 * Bulid step which evaluates the main HTML page template.
 */
export class EvalHTML {
  createActions(ctx: BuildContext, input: EvalHTMLInput): EvalHTMLOutput {
    const template = 'src/index.html';
    const { script } = input;
    const html = 'build/index.html';

    ctx.addAction({
      name: 'EvalHTML',
      inputs: [template, script],
      outputs: [html],
      execute: () => this.evalHTML({ template, script, html }),
    });

    return { html };
  }

  /** Evaluate the HTML template. */
  private async evalHTML(arg: {
    template: string;
    script: string;
    html: string;
  }): Promise<void> {
    const { template, script, html } = arg;
    const templateSrc = fs.promises.readFile(template, 'utf8');
    const scriptSrc = fs.promises.readFile(script, 'utf8');
    const templateFn = Handlebars.compile(await templateSrc);
    const result = templateFn({
      title: 'Internship at the Apocalypse',
      script: inlineJavaScript(await scriptSrc),
    });
    await fs.promises.writeFile(html, result, 'utf8');
  }
}
