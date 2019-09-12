/**
 * Build rules for creating HTML files.
 */

import * as fs from 'fs';

import { BuildAction, BuildContext } from './action';
import { BuildArgs, Config } from './config';

import * as Handlebars from 'handlebars';
import * as htmlMinifierTypes from 'html-minifier'; // Only load if needed.

/** Escape JavaScript for embedding in script tag. */
function inlineJavaScript(js: string): Handlebars.SafeString {
  return new Handlebars.SafeString(
    js.replace('</script', '<\\/script').replace('<!--', '<\\!--'),
  );
}

/** Parameters for the EvalHTML build rule. */
export interface EvalHTMLParams {
  /** Path to the input HTML template. */
  readonly template: string;
  /** Path to the script to embed in the HTML. */
  readonly script?: string;
  /** Path to the worker to embed in the HTML. */
  readonly worker?: string;
  /** Path to the data to embed in the HTML. */
  readonly data?: string;
  /** Title of the page. */
  readonly title: string;
  /** Output HTML path. */
  readonly output: string;
}

/** Minify an HTML document. */
function minifyHTML(text: string): string {
  const htmlMinifier = require('html-minifier') as typeof htmlMinifierTypes;
  const result = htmlMinifier.minify(text, {
    collapseBooleanAttributes: true,
    collapseWhitespace: true,
    decodeEntities: true,
    ignoreCustomFragments: [/\{\{.*?\}\}/], // Close enough.
    minifyCSS: true,
    removeAttributeQuotes: true,
    removeComments: true,
    removeOptionalTags: true,
    useShortDoctype: true,
  });
  return result;
}

/**
 * Bulid action which evaluates the main HTML page template.
 */
class EvalHTML implements BuildAction {
  private readonly params: EvalHTMLParams;

  constructor(params: EvalHTMLParams) {
    this.params = params;
  }

  get name(): string {
    return `EvalHTML ${this.params.output}`;
  }
  get inputs(): readonly string[] {
    const inputs = [this.params.template];
    if (this.params.script) {
      inputs.push(this.params.script);
    }
    if (this.params.data) {
      inputs.push(this.params.data);
    }
    return inputs;
  }
  get outputs(): readonly string[] {
    return [this.params.output];
  }

  /** Evaluate the HTML template. */
  async execute(config: BuildArgs): Promise<boolean> {
    const { params } = this;
    const { script, worker, data } = params;
    const scriptSrc = script
      ? fs.promises
          .readFile(script, 'utf8')
          .then(x => inlineJavaScript(x.trim()))
      : null;
    const workerSrc = worker
      ? fs.promises
          .readFile(worker, 'utf8')
          .then(x => inlineJavaScript(x.trim()))
      : null;
    const dataSrc = data
      ? fs.promises.readFile(data, 'utf8').then(inlineJavaScript)
      : null;
    let templateSrc = await fs.promises.readFile(params.template, 'utf8');
    if (config.config == Config.Competition) {
      templateSrc = minifyHTML(templateSrc);
    }
    const templateFn = Handlebars.compile(templateSrc);
    const result = templateFn({
      title: params.title,
      script: await scriptSrc,
      worker: await workerSrc,
      data: await dataSrc,
    });
    await fs.promises.writeFile(params.output, result, 'utf8');
    return true;
  }
}

/**
 * Emit build actions to expand main page HTML templates.
 */
export function evalHTML(ctx: BuildContext, params: EvalHTMLParams): void {
  ctx.addAction(new EvalHTML(params));
}
