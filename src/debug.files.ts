/** Watchers for file changes. */
const watchers: (() => void)[] = [];

const EmptyFile: DataFile = {
  name: '<empty>',
  data: null,
  version: 0,
};

/**
 * Information about a single file.
 */
export interface DataFile {
  name: string;
  data: string | null;
  version: number;
}

/** Information about all data files. */
const files = new Map<string, DataFile>();

/** Maximum version of any file. */
let fileVersion: number = 0;

/** Get the file with the given name, or the empty file if it doesn't exist. */
export function getFile(name: string): DataFile {
  return files.get(name) || EmptyFile;
}

/** Update data files. */
export function updateFiles(updates: DataFile[]): void {
  const version = ++fileVersion;
  for (const file of updates) {
    file.version = version;
    files.set(file.name, file);
  }
  for (const watcher of watchers) {
    watcher();
  }
}

/** Watch changes to files. */
export function watchFiles(func: () => void): void {
  watchers.push(func);
  if (fileVersion > 0) {
    func();
  }
}
