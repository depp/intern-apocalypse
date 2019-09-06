/**
 * Build rules for creating HTML files.
 */

import * as fs from 'fs';

import { BuildAction, BuildContext } from './action';
import { BuildArgs, Config } from './config';

import * as Handlebars from 'handlebars';
import * as htmlMinifierTypes from 'html-minifier'; // Only load if needed.
import { dataPath } from './loader';

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
  readonly script: string;
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
    return [this.params.template, this.params.script];
  }
  get outputs(): readonly string[] {
    return [this.params.output];
  }

  /** Evaluate the HTML template. */
  async execute(config: BuildArgs): Promise<boolean> {
    const { params } = this;
    const scriptSrc = fs.promises.readFile(params.script, 'utf8');
    const dataSrc = fs.promises.readFile(dataPath, 'utf8');
    let templateSrc = await fs.promises.readFile(params.template, 'utf8');
    if (config.config == Config.Release) {
      templateSrc = minifyHTML(templateSrc);
    }
    const templateFn = Handlebars.compile(templateSrc);
    const result = templateFn({
      title: params.title,
      script: inlineJavaScript((await scriptSrc).trimEnd()),
      data: inlineJavaScript(await dataSrc),
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
