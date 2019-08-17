/**
 * Build rules for creating HTML files.
 */

import * as fs from 'fs';

import { BuildAction, BuildContext } from './action';

import * as Handlebars from 'handlebars';

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
  async execute(): Promise<void> {
    const { params } = this;
    const templateSrc = fs.promises.readFile(params.template, 'utf8');
    const scriptSrc = fs.promises.readFile(params.script, 'utf8');
    const templateFn = Handlebars.compile(await templateSrc);
    const result = templateFn({
      title: params.title,
      script: inlineJavaScript(await scriptSrc),
    });
    await fs.promises.writeFile(params.output, result, 'utf8');
  }
}

/**
 * Emit build actions to expand main page HTML templates.
 */
export function evalHTML(ctx: BuildContext, params: EvalHTMLParams): void {
  ctx.addAction(new EvalHTML(params));
}
