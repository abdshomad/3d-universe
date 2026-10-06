/**
 * Static server for the atlas.
 *
 * Reads the port from `.env` so the address is configuration, not a habit.
 * The repository root is the document root: `/web` holds the app, `/assets`
 * the baked tiles, `/node_modules` the three.js build the import map points at.
 */

import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.u3dtile': 'application/octet-stream',
};

export function loadEnv(path = join(ROOT, '.env')) {
  const values = {};
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  // The environment outranks the file, so a caller can
  // point this server elsewhere without editing `.env`.
  for (const key of Object.keys(values)) {
    if (process.env[key] !== undefined) values[key] = process.env[key];
  }
  return values;
}


export function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = normalize(join(ROOT, decoded));
  if (!candidate.startsWith(ROOT)) return null; // no escaping the document root
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    const index = join(candidate, 'index.html');
    return existsSync(index) ? index : null;
  }
  return existsSync(candidate) ? candidate : null;
}

export function createStaticServer() {
  return createServer((request, response) => {
    const path = (request.url ?? '/').split('?')[0];
    if (path === '/' || path === '/index.html') {
      // The atlas lives at /web/index.html and its import map is
      // relative to that directory, so the root must send the
      // browser there, not serve the file under another base.
      response.writeHead(302, { location: '/web/index.html' });
      response.end();
      return;
    }
    const filePath = resolveRequestPath(request.url ?? '/');
    if (!filePath) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('not found');
      return;
    }
    response.writeHead(200, {
      'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(filePath).pipe(response);
  });
}

const env = loadEnv();
const port = Number(env.PORT ?? 8123);
const host = env.HOST ?? '127.0.0.1';
createStaticServer().listen(port, host, () => {
  console.log(`3D Universe served on http://${host}:${port}/`);
});
