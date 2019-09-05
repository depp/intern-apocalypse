import * as watchman from 'fb-watchman';
import { projectRoot } from './util';

/** Information about a file, from a watcher. */
export interface FileInfo {
  name: string;
  size: number;
  mtime_ms: number;
  exists: boolean;
  type: 'b' | 'c' | 'd' | 'f' | 'p' | 'l' | 's' | 'D';
}

/** Object which watches files. */
export interface Watcher {
  subscribe(
    relative_root: string,
    expression: any,
    handler: (files: FileInfo[]) => void,
  ): Promise<string>;
  unsubscribe(name: string): Promise<void>;
}

/** Create a watchman watcher and check that it's working. */
export async function createWatcher(): Promise<Watcher> {
  const watcher = new watchman.Client();
  await new Promise((resolve, reject) => {
    watcher.capabilityCheck(
      { optional: [], required: ['relative_root'] },
      (err, resp) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      },
    );
  });
  const { watch } = await new Promise((resolve, reject) => {
    watcher.command(['watch-project', projectRoot], (err, resp) => {
      if (err) {
        reject(err);
      } else {
        if ('warning' in resp) {
          console.warn(`warning: ${resp.warning}`);
        }
        resolve(resp);
      }
    });
  });
  let index = 0;
  const handlers = new Map<string, (resp: any) => void>();
  return {
    subscribe(
      relative_root: string,
      expression: any,
      handler: (files: FileInfo[]) => void,
    ): Promise<string> {
      const name = `${index++}`;
      const sub = {
        relative_root,
        expression,
        fields: ['name', 'size', 'mtime_ms', 'exists', 'type'],
      };
      const whandler = (resp: any): void => {
        if (resp.subscription == name) {
          handler(resp.files);
        }
      };
      handlers.set(name, whandler);
      watcher.on('subscription', whandler);
      return new Promise<string>((resolve, reject) => {
        watcher.command(['subscribe', watch, name, sub], (err, resp) => {
          if (err) {
            watcher.removeListener('subscription', whandler);
            handlers.delete(name);
            reject(err);
          } else {
            if ('warning' in resp) {
              console.warn(`warning: ${resp.warning}`);
            }
            resolve(name);
          }
        });
      });
    },
    unsubscribe(name: string): Promise<void> {
      const whandler = handlers.get(name);
      if (whandler == null) {
        return Promise.resolve();
      }
      handlers.delete(name);
      watcher.removeListener('subscription', whandler);
      return new Promise<void>((resolve, reject) => {
        watcher.command(['unsubscribe', projectRoot, name], (err, resp) => {
          if (err) {
            reject(err);
          } else {
            if ('warning' in resp) {
              console.warn(`warning: ${resp.warning}`);
            }
            resolve();
          }
        });
      });
    },
  };
}
