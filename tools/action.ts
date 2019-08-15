/**
 * Simple system executing build actions.
 */

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

export class Builder {
  async build(createActions: ActionCreator): Promise<void> {
    const actions: BuildAction[] = [];
    createActions(new BuildContext(actions));
    for (const action of actions) {
      console.log(`Action: ${action.name}`);
      await action.execute();
    }
  }
}
