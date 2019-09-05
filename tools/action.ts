/**
 * Simple system executing build actions.
 */

import * as fs from 'fs';
import * as path from 'path';

import { SyncEvent } from 'ts-events';

import { BuildArgs, Config } from './config';
import { recursive, listFilesWithExtensions, pathExt } from './util';
import { Watcher, FileInfo } from './watch';

export { recursive };

/**
 * A build action which can be run through a BuildContext.
 */
export interface BuildAction {
  /** Name of the action, to print when building. */
  readonly name: string;

  /**
   * List of all possible action inputs.
   *
   * Some of these inputs may not exist. This will happen if the build step that
   * produces them did not produce them.
   */
  inputs: ReadonlyArray<string>;

  /**
   * List of all possible action outputs.
   *
   * The action is not required to produce all its declared outputs, it can
   * produce a subset.
   */
  outputs: ReadonlyArray<string>;

  /**
   * Run the action.
   *
   * @returns True if the action succeeded.
   */
  execute(config: Readonly<BuildArgs>): Promise<boolean>;
}

/**
 * A request to list files.
 */
interface ListFileRequest {
  readonly dirpath: string;
  readonly exts: readonly string[];
  readonly recursive: boolean;
}

/**
 * A context for running build actions.
 */
export class BuildContext {
  readonly config: Readonly<BuildArgs>;
  /** List of all build, in the order they are added. */
  private readonly actions: BuildAction[];
  private readonly listFilesRequests: ListFileRequest[];

  constructor(
    config: Readonly<BuildArgs>,
    actions: BuildAction[],
    listFilesRequests: ListFileRequest[],
  ) {
    this.config = config;
    this.actions = actions;
    this.listFilesRequests = listFilesRequests;
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
    exts: readonly string[],
    flag?: typeof recursive,
  ): readonly string[] {
    const files = listFilesWithExtensions(dirpath, exts, flag);
    files.sort();
    this.listFilesRequests.push({
      dirpath,
      exts,
      recursive: flag == recursive,
    });
    return files;
  }
}

/** A function which emits build actions. */
export type ActionEmitter = (ctx: BuildContext) => void;

interface FileMetadata {
  filename: string;
  exists: boolean;
  clock: number;
  isOutput: boolean;
}

interface ActionCacheEntry {
  /** Whether the action succeeded. */
  success: boolean;
  /** List of all inputs. */
  inputs: readonly string[];
  /** Maximum clock of any input. */
  clock: number;
}

/** The state of a build operation. */
export enum BuildState {
  /** The build is out of date and needs to be run. */
  Dirty,
  /** The build is currently being run. */
  Building,
  /** The build has been run and all outputs are up to date. */
  Clean,
  /** The build ran unsuccessfully. */
  Failed,
}

/** Format a high-resolution timestamp as a number. */
function formatHRTime(time: [number, number]): string {
  const [s, ns] = time;
  const sns = ns.toString().padStart(9, '0');
  return `${s}.${sns.substring(0, 3)}s`;
}

function filesEqual(x: readonly string[], y: readonly string[]): boolean {
  if (x.length != y.length) {
    return false;
  }
  for (let i = 0; i < x.length; i++) {
    if (x[i] != y[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Builder for running build steps when necessary.
 */
export class Builder {
  /** Build configuration options. */
  private readonly config: Readonly<BuildArgs>;
  /** Function which returns a list of actions in the build. */
  private readonly createActions: ActionEmitter;
  /** If true, show the build times. */
  private readonly showBuildTimes: boolean;
  /** The current state of the build. */
  private _state = BuildState.Dirty;
  /** Cached result of createActions. */
  private actions: readonly BuildAction[] | null = null;
  /** File lists requested when creating the actions. */
  private listFilesRequests: readonly ListFileRequest[] | null = null;
  /** Cached results of running actions, indexed by action name. */
  private readonly actionCache = new Map<string, ActionCacheEntry>();
  /** Cached metadata for files. */
  private readonly fileCache = new Map<string, FileMetadata>();
  /** Set of all inputs to actions in current or most recent build. */
  private readonly inputs = new Set<string>();
  /** Indicates that the inputs have changed during the build. */
  private inputsDidChange = false;
  /** Internal clock for comparing when files changed. */
  private watchClock = 0;

  /** Called after the state changes. */
  readonly stateChanged = new SyncEvent<BuildState>();

  constructor(createActions: ActionEmitter, options: Readonly<BuildArgs>) {
    const { showBuildTimes } = options;
    this.config = options;
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

  /** Update metadata for a single file, without reading from the cache. */
  private async scanOutput(filename: string, clock: number): Promise<void> {
    let exists: boolean;
    try {
      await fs.promises.stat(filename);
      exists = true;
    } catch (e) {
      if (e.code != 'ENOENT') {
        throw e;
      }
      exists = false;
    }
    this.fileCache.set(filename, {
      filename,
      exists,
      clock,
      isOutput: true,
    });
  }

  /**
   * Build the targets, running all actions that are out of date.
   *
   * @returns True if the build succeeded.
   */
  async build(): Promise<boolean> {
    if (this._state == BuildState.Building) {
      throw new Error('concurrent call to Builder.build');
    }
    this.setState(BuildState.Building);
    this.inputs.clear();
    this.inputsDidChange = false;
    for (const action of this.getActions()) {
      const success = await this.runAction(action);
      if (this.inputsDidChange) {
        this.setState(BuildState.Dirty);
        return false;
      }
      if (!success) {
        this.setState(BuildState.Failed);
        return false;
      }
    }
    this.setState(BuildState.Clean);
    return true;
  }

  /** Build the targets asynchronously, and rebuild them as inputs change. */
  async watch(watcher: Watcher): Promise<void> {
    await watcher.subscribe('src', ['match', '*.ts'], files =>
      this.didChange('src', files),
    );
    if (this.config.config == Config.Release) {
      await watcher.subscribe(
        'shader',
        ['anyof', ['match', '*.frag'], ['match', '*.vert']],
        files => this.didChange('shader', files),
      );
    }
    setTimeout(() => this.watchLoop(), 100);
  }

  /** Main watch loop. */
  private async watchLoop(): Promise<void> {
    try {
      while (true) {
        await this.build();
        await this.waitUntilDirty();
      }
    } catch (e) {
      console.error('Uncaught build error:', e);
      process.exit(1);
    }
  }

  /** Get a list of all actions to run. */
  private getActions(): readonly BuildAction[] {
    // Note: It is especially convenient that this function is synchronous. This
    // means that there is no gap while this function is running where we might
    // want to invalidate the build because files are added or removed.
    if (this.actions != null) {
      return this.actions;
    }
    const actions: BuildAction[] = [];
    const listFilesRequests: ListFileRequest[] = [];
    this.createActions(
      new BuildContext(this.config, actions, listFilesRequests),
    );
    // Remove cache entries from actions that don't exist any more.
    const actionSet = new Set(actions.map(action => action.name));
    for (const name of this.actionCache.keys()) {
      if (!actionSet.has(name)) {
        this.actionCache.delete(name);
      }
    }
    this.actions = actions;
    this.listFilesRequests = listFilesRequests;
    return actions;
  }

  /**
   * Get the clock value for the listed files.
   */
  private filesClock(names: readonly string[]): number {
    let clock = 0;
    for (const name of names) {
      const file = this.fileCache.get(name);
      if (file != null) {
        clock = Math.max(file.clock, clock);
      }
    }
    return clock;
  }

  /**
   * Run a single action if it is out of date.
   *
   * @returns True if the action executed successfully.
   */
  private async runAction(action: BuildAction): Promise<boolean> {
    const startTime = process.hrtime();
    const { name, inputs, outputs } = action;
    for (const input of inputs) {
      this.inputs.add(input);
    }
    const clock = this.filesClock(inputs);
    const preventry = this.actionCache.get(name);
    if (
      preventry != null &&
      clock == preventry.clock &&
      filesEqual(inputs, preventry.inputs)
    ) {
      return preventry.success;
    }
    console.log(`Build ${name}`);
    // Delete outputs so we don't accidentally get something stale.
    for (const output of outputs) {
      try {
        await fs.promises.unlink(output);
      } catch (e) {
        if (e.code != 'ENOENT') {
          throw e;
        }
      }
    }
    this.actionCache.delete(name);
    let success: boolean;
    try {
      success = await action.execute(this.config);
    } catch (e) {
      console.error(e);
      success = false;
    }
    // It is OK if the outputs are not created. Actions must deal with this.
    for (const output of outputs) {
      await this.scanOutput(output, clock);
    }
    this.actionCache.set(name, {
      success,
      inputs,
      clock,
    });
    const elapsed = process.hrtime(startTime);
    if (this.showBuildTimes) {
      console.log(`Action ${name} completed in ${formatHRTime(elapsed)}`);
    }
    if (this.filesClock(inputs) != clock) {
      this.inputsDidChange = true;
    }
    return success;
  }

  /**
   * Invalidate the build inputs, marking the build as dirty. If the build is
   * currently building, it will be marked dirty after the current action
   * completes.
   */
  private markBuildDirty(): void {
    switch (this._state) {
      case BuildState.Building:
        this.inputsDidChange = true;
        break;
      case BuildState.Clean:
      case BuildState.Failed:
        this.setState(BuildState.Dirty);
        break;
    }
  }

  /** Called when watched files change. */
  private didChange(base: string, files: FileInfo[]): void {
    const clock = ++this.watchClock;
    let dirty = false;
    for (const file of files) {
      const filename = path.join(base, file.name);
      const entry = this.fileCache.get(filename);
      if (entry == null) {
        this.fileCache.set(filename, {
          filename,
          exists: file.exists,
          clock,
          isOutput: false,
        });
        this.actions = null;
        dirty = true;
      } else if (!entry.isOutput) {
        if (file.exists != entry.exists) {
          this.actions = null;
          dirty = true;
        }
        entry.exists = file.exists;
        entry.clock = clock;
      }
      if (this.inputs.has(filename)) {
        dirty = true;
      }
    }
    if (dirty) {
      this.markBuildDirty();
    }
  }

  /** Return true if the file matches any request to list files. */
  private fileMatchesAnyList(filename: string): boolean {
    if (this.listFilesRequests == null) {
      return false;
    }
    const ext = pathExt(filename);
    for (const req of this.listFilesRequests) {
      const { dirpath, exts, recursive } = req;
      if (!exts.includes(ext)) {
        continue;
      }
      if (recursive) {
        const prefix =
          dirpath != '' && dirpath.endsWith('/') ? dirpath : dirpath + '/';
        if (!filename.startsWith(prefix)) {
          continue;
        }
      } else if (path.dirname(filename) != dirpath) {
        continue;
      }
      return true;
    }
    return false;
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
