/**
 * Simple system executing build actions.
 */

import * as fs from 'fs';

import { recursive, listFilesWithExtensions } from './util';

export { recursive };

/**
 * A build action which can be run through a BuildContext.
 */
export interface BuildAction {
  /** Name of the action, to print when building. */
  readonly name: string;
  /** List of all possible action inputs. */
  inputs: ReadonlyArray<string>;
  /** List of all possible action outputs. */
  outputs: ReadonlyArray<string>;
  /** Run the action. */
  execute(): Promise<void>;
}

/**
 * A context for running build actions.
 */
export class BuildContext {
  /** List of all build, in the order they are added. */
  private readonly actions: BuildAction[];

  constructor(actions: BuildAction[]) {
    this.actions = actions;
  }

  /**
   * Schedule an build action to run. The build action may depend on outputs
   * from any previously scheduled build action.
   */
  addAction(action: BuildAction): void {
    this.actions.push(action);
  }

  /**
   * List files in a given directory with the given extensions. Results will
   * start with the path to the base directory. The extensions should include
   * the leading dot. Files and directories starting with '.' will be skipped.
   * The result will be sorted.
   */
  listFilesWithExtensions(
    dirpath: string,
    exts: ReadonlyArray<string>,
    flag?: typeof recursive,
  ): ReadonlyArray<string> {
    const files = listFilesWithExtensions(dirpath, exts, flag);
    files.sort();
    return files;
  }
}

/** A function which creates build actions. */
export type ActionCreator = (ctx: BuildContext) => void;

interface CacheInput {
  filename: string;
  mtime: number;
}

interface ActionCacheEntry {
  inputs: CacheInput[];
}

/** Return true if two lists of inputs are equal to each other. */
function inputsEqual(
  xinputs: readonly CacheInput[],
  yinputs: readonly CacheInput[],
): boolean {
  if (xinputs.length != yinputs.length) {
    return false;
  }
  for (let i = 0; i < xinputs.length; i++) {
    const x = xinputs[i];
    const y = yinputs[i];
    if (x.filename != y.filename || x.mtime != y.mtime) {
      return false;
    }
  }
  return true;
}

/** Return after the given delay, in milliseconds. */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(() => resolve(), ms));
}

/**
 * Builder for running build steps when necessary.
 */
export class Builder {
  /** Function which returns a list of actions in the build. */
  private readonly createActions: ActionCreator;
  /** Cached result of createActions. */
  private actions: BuildAction[] | null = null;
  /** Cached results of running actions, indexed by action name. */
  private readonly actionCache: Map<string, ActionCacheEntry> = new Map<
    string,
    ActionCacheEntry
  >();

  constructor(createActions: ActionCreator) {
    this.createActions = createActions;
  }

  /** Get metadata for a single input file. */
  private async scanInput(filename: string): Promise<CacheInput> {
    const stat = await fs.promises.stat(filename);
    return { filename, mtime: stat.mtimeMs };
  }

  /** Get metadata for a list of input files. */
  private scanInputs(filenames: readonly string[]): Promise<CacheInput[]> {
    return Promise.all(filenames.map(filename => this.scanInput(filename)));
  }

  /** Build the targets, running all actions that are out of date. */
  async build(): Promise<void> {
    for (const action of this.getActions()) {
      await this.runAction(action);
    }
  }

  /** Build all targets asynchronously, and rebuild them as files change. */
  watch(): void {
    (async () => {
      while (true) {
        await this.build();
        await delay(1000);
      }
    })();
  }

  /** Get a list of all actions to run. */
  private getActions(): readonly BuildAction[] {
    let actions = this.actions;
    if (actions == null) {
      actions = [];
      this.createActions(new BuildContext(actions));
      this.actions = actions;
    }
    return actions;
  }

  /** Run a single action if it is out of date. */
  private async runAction(action: BuildAction): Promise<void> {
    const { name, inputs } = action;
    const curinputs = await this.scanInputs(inputs);
    const preventry = this.actionCache.get(name);
    if (preventry != null) {
      if (inputsEqual(curinputs, preventry.inputs)) {
        return;
      }
    }
    console.log(`Action: ${name}`);
    this.actionCache.delete(name);
    await action.execute();
    this.actionCache.set(name, {
      inputs: curinputs,
    });
  }
}
