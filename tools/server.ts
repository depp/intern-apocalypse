/**
 * Development HTTP server.
 */

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import * as send from 'send';
import * as Handlebars from 'handlebars';
import * as WebSocket from 'ws';

import { BuildState, Builder } from './action';
import { Config, BuildArgs } from './config';
import { projectName } from './info';
import { Watcher, FileInfo } from './watch';
import { projectRoot } from './util';

/** Parameters for running the HTTP server. */
export interface ServerParameters extends BuildArgs {
  builder: Builder;
  watcher: Watcher;
}

interface StaticFile {
  readonly url: string;
  readonly file: string;
  readonly sourceMap?: string;
}

/**
 * Map from URLs to static file paths.
 */
const baseFiles: readonly StaticFile[] = [
  { url: '/debug.css', file: 'html/debug.css' },
  { url: '/style.css', file: 'html/style.css' },
  { url: '/game.js', file: 'build/game.js', sourceMap: 'game.js.map' },
  { url: '/game.js.map', file: 'build/game.js.map' },
  { url: '/data.json', file: 'build/data.json' },
  { url: '/dat.gui.js', file: 'node_modules/dat.gui/build/dat.gui.min.js' },
  { url: '/favicon.ico', file: 'misc/favicon.ico' },
];

/** Handle requests for /. */
async function handleRoot(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const source = await fs.promises.readFile('html/debug.html', 'utf8');
    const template = Handlebars.compile(source);
    const text = template({
      title: projectName,
    });
    res.setHeader('Cache-Control', 'no-cache');
    res.send(text);
  } catch (e) {
    next(e);
  }
}

express.static.mime.define({ 'text/x.typescript': ['ts'] });

/** Handle requests for /src. */
function handleSrc(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-cache');
  const reqPath = req.params[0];
  if (!/^[a-z0-9][-_.a-z0-9]*(?:\/[a-z0-9][-_.a-z0-9]*)*$/i.test(reqPath)) {
    res.setHeader('Content-Type', 'text/plain;charset=UTF-8');
    res.status(404).send(`Not found: ${JSON.stringify(reqPath)}`);
    return;
  }
  const fullPath = path.join('src', reqPath);
  send(req, fullPath, {
    cacheControl: false,
  }).pipe(res);
}

/** Create a handler for a file on disk. */
function staticHandler(file: StaticFile): express.RequestHandler {
  return function handler(req: Request, res: Response): void {
    res.setHeader('Cache-Control', 'no-cache');
    const { sourceMap } = file;
    if (sourceMap) {
      res.setHeader('SourceMap', sourceMap);
    }
    send(req, file.file, {
      cacheControl: false,
    }).pipe(res);
  };
}

/**
 * Send the current build state to the client.
 */
function sendBuildState(ws: WebSocket, builder: Builder): void {
  function stateChanged(state: BuildState): void {
    setImmediate(() => {
      ws.send(
        JSON.stringify({
          type: 'status',
          status: BuildState[state],
        }),
      );
    });
  }
  ws.on('close', () => builder.stateChanged.detach(stateChanged));
  stateChanged(builder.state);
  builder.stateChanged.attach(stateChanged);
}

/**
 * Send data files to the client.
 */
async function sendDataFiles(ws: WebSocket, watcher: Watcher): Promise<void> {
  // Delay between when we get FS changes and when we send the data, in
  // milliseconds.
  const delay = 100;
  const changes = new Set<string>();
  let timeout: NodeJS.Timeout | null = null;
  let executing = false;
  let closing = false;
  function sendData(): void {
    if (timeout != null || executing) {
      return;
    }
    timeout = setTimeout(async () => {
      timeout = null;
      try {
        executing = true;
        const files = new Map<string, string | null>();
        while (changes.size) {
          const names = Array.from(changes);
          changes.clear();
          for (const name of names) {
            if (closing) {
              return;
            }
            let text: string | null;
            try {
              text = await fs.promises.readFile(name, 'utf8');
            } catch (e) {
              if (e.code == 'ENOENT') {
                text = null;
              } else {
                throw e;
              }
            }
            files.set(name, text);
          }
        }
        executing = false;
        if (closing) {
          return;
        }
        const list: any = [];
        for (const [key, value] of files.entries()) {
          list.push(key, value);
        }
        ws.send(
          JSON.stringify({
            type: 'files',
            files: list,
          }),
        );
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    }, delay);
  }
  function onChange(base: string, files: FileInfo[]): void {
    for (const file of files) {
      changes.add(path.join(base, file.name));
    }
    sendData();
  }
  const handles = [
    await watcher.subscribe(
      'shader',
      // TODO: Watchman 5.0 has simpler query syntax.
      ['anyof', ['suffix', 'vert'], ['suffix', 'frag']],
      files => onChange('shader', files),
    ),
    await watcher.subscribe('model', ['suffix', 'txt'], files =>
      onChange('model', files),
    ),
    await watcher.subscribe('audio', ['suffix', 'lisp'], files =>
      onChange('audio', files),
    ),
    await watcher.subscribe('music', ['suffix', 'txt'], files =>
      onChange('music', files),
    ),
  ];
  ws.on('close', () => {
    closing = true;
    for (const handle of handles) {
      watcher.unsubscribe(handle);
    }
    if (timeout != null) {
      clearTimeout(timeout);
    }
  });
}

/**
 * Ping the client regularly.
 */
function sendPings(ws: WebSocket): void {
  let counter = 0;
  const interval = setInterval(() => {
    counter++;
    ws.ping(counter.toString());
  }, 1000);
  ws.on('close', () => clearInterval(interval));
}

/** Handle WebSocket connections. */
function handleWebSocket(options: ServerParameters, ws: WebSocket): void {
  const { builder } = options;
  sendBuildState(ws, builder);
  sendDataFiles(ws, options.watcher);
  sendPings(ws);
}

/** Serve build products over HTTP. */
export function serve(options: ServerParameters) {
  const { host, port } = options;
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  if (options.config == Config.Debug) {
    app.get('/', handleRoot);
  } else {
    app.get('/', staticHandler({ url: '/', file: 'build/index.html' }));
  }
  for (const file of baseFiles) {
    app.get(file.url, staticHandler(file));
  }
  app.get('/src/*', handleSrc);
  wss.on('connection', ws => handleWebSocket(options, ws));

  server.listen(port, host, () => {
    console.log(`Listening on http://${host}:${port}/`);
  });
}
