/**
 * Development HTTP server.
 */

import * as fs from 'fs';
import * as http from 'http';

import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import * as send from 'send';
import * as Handlebars from 'handlebars';
import * as WebSocket from 'ws';

import { BuildState, Builder } from './action';
import { BuildArgs } from './config';

/** Parameters for running the HTTP server. */
export interface ServerParameters extends BuildArgs {
  builder: Builder;
  loadBuilder: Builder;
}

interface StaticFile {
  readonly url: string;
  readonly file: string;
}

/**
 * Map from URLs to static file paths.
 */
const baseFiles: readonly StaticFile[] = [
  { url: '/live.css', file: 'html/live.css' },
  { url: '/loader.js', file: 'build/loader.js' },
  { url: '/static', file: 'build/index.html' },
  { url: '/react.js', file: 'node_modules/react/umd/react.development.js' },
  {
    url: '/react-dom.js',
    file: 'node_modules/react-dom/umd/react-dom.development.js',
  },
  { url: '/game.js', file: 'build/game.js' },
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
      title: 'Intern at the Apocalypse',
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
    send(req, file.file, {
      cacheControl: false,
    }).pipe(res);
  };
}

/** Handle WebSocket connections. */
function handleWebSocket(options: ServerParameters, ws: WebSocket): void {
  const { builder } = options;

  // Send the current build state to the client.
  const stateChanged = (state: BuildState) => {
    setImmediate(() => {
      ws.send(
        JSON.stringify({
          type: 'status',
          status: BuildState[state],
        }),
      );
    });
  };
  stateChanged(builder.state);
  builder.stateChanged.attach(stateChanged);

  // Ping the client.
  let counter = 0;
  const interval = setInterval(() => {
    counter++;
    ws.ping(counter.toString());
  }, 1000);

  // Clean up on close.
  ws.on('close', (code: number, reason: string) => {
    builder.stateChanged.detach(stateChanged);
    clearInterval(interval);
  });
}

/** Serve build products over HTTP. */
export function serve(options: ServerParameters) {
  const { host, port } = options;
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  app.get('/', (res, req, next) => handleRoot(options, res, req, next));
  for (const file of baseFiles) {
    app.get(file.url, staticHandler(file));
  }
  wss.on('connection', ws => handleWebSocket(options, ws));

  server.listen(port, host, () => {
    console.log(`Listening on http://${host}:${port}/`);
  });
}
