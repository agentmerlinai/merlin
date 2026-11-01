import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json',
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = path.join(ROOT, 'dist/client');

/* Static server for the built artifact. Preview and the CI page tests share it,
   so what you open locally is served exactly like GitHub Pages serves it:
   directory URLs resolve to index.html, anything else 404s. */
export function startServer(root = DIST, { port = 0, host = '127.0.0.1' } = {}) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, rel);
    const type = MIME[path.extname(file)];
    if (!file.startsWith(root + path.sep) || !type) {
      res.writeHead(404).end();
      return;
    }
    try {
      res.writeHead(200, { 'content-type': type });
      res.end(fs.readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error(`${DIST}: no build. Run "npm run build" first.`);
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 4173);
  await startServer(DIST, { port });
  console.log(`preview: http://localhost:${port}/`);
}
