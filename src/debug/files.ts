/** Handler for data for a single file. */
export type FileHandler = (data: string | null) => void;

/** Watchers for file changes. */
const watchers = new Map<string, FileHandler[]>();

/**
 * Information about a single file.
 */
export interface DataFile {
  name: string;
  data: string | null;
}

/** Update data files. */
export function updateFiles(updates: DataFile[]): void {
  for (const { name, data } of updates) {
    const handlers = watchers.get(name);
    if (handlers != null) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }
}

/** Watch changes to a single file. */
export function watchFile(name: string, handler: FileHandler): void {
  const handlers = watchers.get(name);
  if (handlers != null) {
    handlers.push(handler);
  } else {
    watchers.set(name, [handler]);
  }
}
