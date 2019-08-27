/**
 * Information about a single file.
 */
export interface DataFile {
  name: string;
  data: string | null;
  version: number;
}

/** Information about all data files. */
export const files = new Map<string, DataFile>();

/** Maximum version of any file. */
export let fileVersion: number = 0;

/** Update data files. */
export function updateFiles(updates: DataFile[]): void {
  const version = ++fileVersion;
  for (const file of updates) {
    file.version = version;
    files.set(file.name, file);
  }
}
