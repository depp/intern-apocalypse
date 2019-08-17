/**
 * Simple system executing build actions.
 */

import * as fs from 'fs';

import * as chokidar from 'chokidar';
import { SyncEvent } from 'ts-events';

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

/** A function which emits build actions. */
export type ActionEmitter = (ctx: BuildContext) => void;

interface FileMetadata {
  filename: string;
  mtime: number;
  dirty: boolean;
}

interface ActionCacheEntry {
  inputs: FileMetadata[];
}

/** Return true if two lists of inputs are equal to each other. */
function inputsEqual(
  xinputs: readonly FileMetadata[],
  yinputs: readonly FileMetadata[],
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

/** The state of a build operation. */
export enum BuildState {
  /** The build is out of date and needs to be run. */
  Dirty,
  /** The build is currently being run. */
  Building,
  /** The build has been run and all outputs are up to date. */
  Clean,
}

/**
 * Configuration options that affect the builder.
 */
export interface BuilderOptions {
  /** If true, print out the amount of time taken by each step. */
  showBuildTimes: boolean;
}

/** Format a high-resolution timestamp as a number. */
function formatHRTime(time: [number, number]): string {
  const [s, ns] = time;
  const sns = ns.toString().padStart(9, '0');
  return `${s}.${sns.substring(0, 3)}s`;
}

/**
 * Builder for running build steps when necessary.
 */
export class Builder {
  /** Function which returns a list of actions in the build. */
  private readonly createActions: ActionEmitter;
  /** If true, show the build times. */
  private readonly showBuildTimes: boolean;
  /** The current state of the build. */
  private _state = BuildState.Dirty;
  /** Cached result of createActions. */
  private actions: BuildAction[] | null = null;
  /** Cached results of running actions, indexed by action name. */
  private readonly actionCache = new Map<string, ActionCacheEntry>();
  /** Cached metadata for files. */
  private readonly fileCache = new Map<string, FileMetadata>();
  /** Set of all inputs to actions in current or most recent build. */
  private readonly inputs = new Set<string>();
  /** Indicates that the inputs have changed during the build. */
  private inputsDidChange = false;

  /** Called after the state changes. */
  readonly stateChanged = new SyncEvent<BuildState>();

  constructor(createActions: ActionEmitter, options: BuilderOptions) {
    const { showBuildTimes } = options;
    this.createActions = createActions;
    this.showBuildTimes = showBuildTimes;
  }

  /** The current state of the build operation. */
  get state(): BuildState {
    return this._state;
  }

  /** Set the current state of the builder. */
  private setState(state: BuildState) {
    if (state != this._state) {
      this._state = state;
      this.stateChanged.post(state);
    }
  }

  /** Get metadata for a single input file. */
  private async scanInput(filename: string): Promise<FileMetadata> {
    let file = this.fileCache.get(filename);
    if (file != null && !file.dirty) {
      return file;
    }
    const stat = await fs.promises.stat(filename);
    file = {
      filename,
      mtime: stat.mtimeMs,
      dirty: false,
    };
    this.fileCache.set(filename, file);
    return file;
  }

  /** Get metadata for a list of input files. */
  private scanInputs(filenames: readonly string[]): Promise<FileMetadata[]> {
    return Promise.all(filenames.map(filename => this.scanInput(filename)));
  }

  /** Build the targets, running all actions that are out of date. */
  async build(): Promise<void> {
    if (this._state == BuildState.Building) {
      throw new Error('concurrent call to Builder.build');
    }
    this.setState(BuildState.Building);
    this.inputs.clear();
    this.inputsDidChange = false;
    for (const action of this.getActions()) {
      await this.runAction(action);
      if (this.inputsDidChange) {
        this.setState(BuildState.Dirty);
        return;
      }
    }
    this.setState(BuildState.Clean);
  }

  /** Build the targets asynchronously, and rebuild them as inputs change. */
  watch(): void {
    const watcher = chokidar.watch('src', {
      ignored: '.*',
    });
    watcher.on('change', (filename, stats) => this.didChange(filename, stats));
    (async () => {
      while (true) {
        await this.build();
        await this.waitUntilDirty();
      }
    })();
  }

  /** Get a list of all actions to run. */
  private getActions(): readonly BuildAction[] {
    let actions = this.actions;
    if (actions != null) {
      return actions;
    }
    actions = [];
    this.createActions(new BuildContext(actions));
    // Remove cache entries from actions that don't exist any more.
    const actionSet = new Set(actions.map(action => action.name));
    for (const name of this.actionCache.keys()) {
      if (!actionSet.has(name)) {
        this.actionCache.delete(name);
      }
    }
    this.actions = actions;
    return actions;
  }

  /** Run a single action if it is out of date. */
  private async runAction(action: BuildAction): Promise<void> {
    const startTime = process.hrtime();
    const { name, inputs, outputs } = action;
    for (const input of inputs) {
      this.inputs.add(input);
    }
    const curinputs = await this.scanInputs(inputs);
    const preventry = this.actionCache.get(name);
    if (preventry != null && inputsEqual(curinputs, preventry.inputs)) {
      return;
    }
    console.log(`Action: ${name}`);
    this.actionCache.delete(name);
    await action.execute();
    for (const output of outputs) {
      const stat = await fs.promises.stat(output);
      const file = {
        filename: output,
        mtime: stat.mtimeMs,
        dirty: false,
      };
      this.fileCache.set(output, file);
    }
    this.actionCache.set(name, {
      inputs: curinputs,
    });
    const elapsed = process.hrtime(startTime);
    if (this.showBuildTimes) {
      console.log(`Action ${name} completed in ${formatHRTime(elapsed)}`);
    }
  }

  /** Called when a watched file changes. */
  private didChange(filename: string, stats: fs.Stats | undefined): void {
    const file = this.fileCache.get(filename);
    if (file != null) {
      file.dirty = true;
    }
    if (this.inputs.has(filename)) {
      switch (this._state) {
        case BuildState.Building:
          this.inputsDidChange = true;
          break;
        case BuildState.Clean:
          this.setState(BuildState.Dirty);
          break;
      }
    }
  }

  /** Wait until the builder is dirty. */
  private waitUntilDirty(): Promise<void> {
    if (this._state == BuildState.Dirty) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const handler = (state: BuildState) => {
        if (state == BuildState.Dirty) {
          this.stateChanged.detach(handler);
          resolve();
        }
      };
      this.stateChanged.attach(handler);
    });
  }
}
