/**
 * Development HTTP server.
 */

import * as fs from 'fs';

import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import * as send from 'send';
import * as Handlebars from 'handlebars';

/** Server configuration options. */
export interface ServerOptions {
  port: number;
  host: string;
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
];

function staticHandler(file: StaticFile): express.RequestHandler {
  return function handler(req: Request, res: Response): void {
    res.setHeader('Cache-Control', 'no-cache');
    send(req, file.file, {
      cacheControl: false,
    }).pipe(res);
  };
}

/** Serve build products over HTTP. */
export function serve(options: ServerOptions) {
  const { host, port } = options;
  const app = express();
  app.get('/', async (req: Request, res: Response, next: NextFunction) => {
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
  });
  for (const file of baseFiles) {
    app.get(file.url, staticHandler(file));
  }
  app.listen(port, host, () => {
    console.log(`Listening on http://${host}:${port}/`);
  });
}
