/**
 * Development HTTP server.
 */

import * as http from 'http';

import * as express from 'express';

/** Server configuration options. */
export interface ServerOptions {
  port: number;
  host: string;
}

/** Serve build products over HTTP. */
export function serve(options: ServerOptions) {
  const { host, port } = options;
  const app = express();
  app.use(
    express.static('build', {
      setHeaders(res: http.ServerResponse, path: string) {
        res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  app.listen(port, host, () => {
    console.log(`Listening on http://${host}:${port}/`);
  });
}
