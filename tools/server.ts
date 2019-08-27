/**
 * Development HTTP server.
 */

import * as fs from 'fs';
import * as http from 'http';

import * as chokidar from 'chokidar';
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import * as send from 'send';
import * as Handlebars from 'handlebars';
import * as WebSocket from 'ws';

import { BuildState, Builder } from './action';
import { Config, BuildArgs } from './config';
import { projectName } from './info';

/** Parameters for running the HTTP server. */
export interface ServerParameters extends BuildArgs {
  builder: Builder;
}

interface StaticFile {
  readonly url: string;
  readonly file: string;
  readonly sourceMap?: string;
  readonly config?: Config;
}

/**
 * Map from URLs to static file paths.
 */
const baseFiles: readonly StaticFile[] = [
  { url: '/live.css', file: 'html/live.css' },
  { url: '/static', file: 'build/index.html', config: Config.Release },
  { url: '/game.js', file: 'build/game.js', sourceMap: 'game.js.map' },
  { url: '/game.js.map', file: 'build/game.js.map' },
  { url: '/dat.gui.js', file: 'node_modules/dat.gui/build/dat.gui.min.js' },
];

/** Handle requests for /. */
async function handleRoot(
  options: ServerParameters,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const source = await fs.promises.readFile('html/live.html', 'utf8');
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
function sendDataFiles(ws: WebSocket): void {
  // Delay between when we get FS changes and when we send the data, in
  // milliseconds.
  const delay = 100;
  const changes = new Set<string>();
  const watcher = chokidar.watch(['shader/*.vert', 'shader/*.frag'], {
    ignored: '.*',
  });
  let timeout: NodeJS.Timeout | null = null;
  let executing = false;
  let closing = false;
  let ready = false;
  function sendData(): void {
    if (!ready || timeout != null || executing) {
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
  function onChange(filename: string): void {
    console.log('filename', filename);
    changes.add(filename);
    sendData();
  }
  function onReady(): void {
    ready = true;
    sendData();
  }
  ws.on('close', () => {
    closing = true;
    watcher.close();
    if (timeout != null) {
      clearTimeout(timeout);
    }
  });
  watcher.on('add', onChange);
  watcher.on('unlink', onChange);
  watcher.on('change', onChange);
  watcher.on('ready', onReady);
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
  sendDataFiles(ws);
  sendPings(ws);
}

/** Serve build products over HTTP. */
export function serve(options: ServerParameters) {
  const { host, port } = options;
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  app.get('/', (res, req, next) => handleRoot(options, res, req, next));
  for (const file of baseFiles) {
    if (file.config == null || file.config == options.config) {
      app.get(file.url, staticHandler(file));
    }
  }
  wss.on('connection', ws => handleWebSocket(options, ws));

  server.listen(port, host, () => {
    console.log(`Listening on http://${host}:${port}/`);
  });
}
